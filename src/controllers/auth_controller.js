import User from "../models/user_schema.js";
import bcrypt from "bcryptjs";
import generateToken from "../utils/jwt.js";
import crypto from "crypto";
import { sendVerificationEmail } from "../services/email_server.js";
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({
      email,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }
    // password must include at least one uppercase letter, one lowercase letter, one number, and one special character
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])/.test(password)) {
      return res.status(400).json({
        message:
          "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Hash token before storing it
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    newUser.emailVerificationToken = hashedVerificationToken;

    newUser.emailVerificationTokenExpiry = Date.now() + 15 * 60 * 1000;

    // Save user first
    await newUser.save();

    // Send verification email
    await sendVerificationEmail(newUser.email, verificationToken);

    // Generate JWT
    const token = generateToken(newUser._id);

    return res.status(201).json({
      message: "User registered successfully",

      token,

      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error registering user: " + error.message,
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

    // 🔐 Email verification check
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verdify your email before logging in.",
      });
    }

    // 🔑 Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    // 🎫 Generate JWT
    const token = generateToken(user._id);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error logging in user: " + error.message,
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

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiry: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiry = null;

    await user.save();

    res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export { registerUser, loginUser, verifyEmail };
