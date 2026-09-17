import User from "../models/user_schema.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import generateToken from "../utils/jwt.js";
import { sendVerificationEmail } from "../services/email_server.js";

const VERIFICATION_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Tokens are stored hashed — a DB leak then can't be replayed to verify.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const buildVerificationToken = (user) => {
  const token = crypto.randomBytes(32).toString("hex");

  user.emailVerificationToken = hashToken(token);
  user.emailVerificationTokenExpiry = Date.now() + VERIFICATION_TOKEN_TTL_MS;

  // The plain token only ever exists here — it goes out in the email.
  return token;
};

// Email sending happens in the background so a slow SMTP provider can
// never delay the HTTP response.
const sendEmailInBackground = (user, token) => {
  sendVerificationEmail(user.email, token).catch((error) => {
    console.error("Verification email failed:", error.message);
  });
};

const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Validate the password before touching the DB so a weak password
    // gets a validation error even when the email is already taken.
    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])/.test(password)) {
      return res.status(400).json({
        message:
          "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // Verified account → nothing to register, point them at login.
      if (existingUser.isEmailVerified) {
        return res.status(400).json({
          message: "User already exists. Please login.",
        });
      }

      // Registered but never verified (first email lost, typo in another
      // field, …) — resend a fresh token instead of blocking them.
      const token = buildVerificationToken(existingUser);
      await existingUser.save();

      sendEmailInBackground(existingUser, token);

      return res.status(200).json({
        message:
          "An account with this email already exists. A new verification email has been sent.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    const token = buildVerificationToken(newUser);
    await newUser.save();

    sendEmailInBackground(newUser, token);

    return res.status(201).json({
      message: "User registered successfully",
      token: generateToken(newUser._id),
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      message: "Error registering user",
    });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "User not found",
      });
    }

    // Unverified accounts can't log in — that's the whole point of the check.
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    return res.status(200).json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Error logging in user",
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: "Verification token is missing",
      });
    }

    const user = await User.findOne({
      emailVerificationToken: hashToken(token),
      emailVerificationTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link",
      });
    }

    // Clear the token after use — a verification link is single-use.
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;

    await user.save();

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({
      message: "Error verifying email",
    });
  }
};

export { registerUser, loginUser, verifyEmail };
