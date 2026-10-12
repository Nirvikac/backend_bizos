import User from "../models/user_schema.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import generateToken from "../utils/jwt.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../services/email_server.js";

const VERIFICATION_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Tokens are stored hashed — a DB leak then can't be replayed to verify.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Shared password policy so register and reset can never drift apart.
const validatePassword = (password) => {
  if (!password || password.length < 6) {
    return "Password must be at least 6 characters long";
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%*?&])/.test(password)) {
    return "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character";
  }

  return null;
};

const buildVerificationToken = (user) => {
  const token = crypto.randomBytes(32).toString("hex");

  user.emailVerificationToken = hashToken(token);
  user.emailVerificationTokenExpiry = Date.now() + VERIFICATION_TOKEN_TTL_MS;

  // The plain token only ever exists here — it goes out in the email.
  return token;
};

const buildPasswordResetToken = (user) => {
  const token = crypto.randomBytes(32).toString("hex");

  user.passwordResetToken = hashToken(token);
  user.passwordResetTokenExpiry = Date.now() + PASSWORD_RESET_TOKEN_TTL_MS;

  // The plain token only ever exists here — it goes out in the email.
  return token;
};

// Resolve the frontend origin shared by verification and reset emails: an
// explicit FRONTEND_URL env var wins, then the request's Origin header
// (covers localhost dev and any deployed host), and localhost last.
const resolveFrontendBase = (req) =>
  process.env.FRONTEND_URL || req.get("origin") || "http://localhost:3000";

// Email sending happens in the background so a slow SMTP provider can
// never delay the HTTP response.
const sendEmailInBackground = (user, token, frontendBase) => {
  sendVerificationEmail(user.email, token, frontendBase).catch((error) => {
    console.error("Verification email failed:", error.message);
  });
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    // Validate the password before touching the DB so a weak password
    // gets a validation error even when the email is already taken.
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
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

      sendEmailInBackground(existingUser, token, resolveFrontendBase(req));

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

    sendEmailInBackground(newUser, token, resolveFrontendBase(req));

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
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }
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

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    // Always answer the same way so this endpoint can't be used to discover
    // which emails are registered.
    const genericResponse = {
      message:
        "If an account with that email exists, we've sent a password reset link.",
    };

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const token = buildPasswordResetToken(user);
    await user.save();

    const frontendBase = resolveFrontendBase(req);

    // Email sending happens in the background so a slow SMTP provider can
    // never delay the HTTP response.
    sendPasswordResetEmail(user.email, token, frontendBase).catch((error) => {
      console.error("Password reset email failed:", error.message);
    });

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      message: "Error processing password reset request",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({
        message: "Reset link token and new password are required",
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const user = await User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link. Please request a new one.",
      });
    }

    user.password = await bcrypt.hash(password, 10);

    // Single-use — clear the token so the link can't be reused.
    user.passwordResetToken = null;
    user.passwordResetTokenExpiry = null;

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      message: "Error resetting password",
    });
  }
};

// Sliding session: the web app calls this on load with its stored token and
// gets a freshly minted one back, so active users never see a login screen.
// Only a verified account can extend its session — an unverified, deleted,
// or expired one gets a 401 and the client drops the stored token.
const refreshSession = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || !user.isEmailVerified) {
      return res.status(401).json({ message: "Invalid token." });
    }

    return res.status(200).json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({
      message: "Error refreshing session",
    });
  }
};

export {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshSession,
};
