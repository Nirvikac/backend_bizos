import express from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshSession,
} from "../controllers/auth_controller.js";
import { authMiddleware } from "../middlewares/auth_middleware.js";
const authrouter = express.Router();

// Register route
authrouter.post("/register", registerUser);

// Login route
authrouter.post("/login", loginUser);

// Verification route
authrouter.get("/verify-email", verifyEmail);

// Password reset routes
authrouter.post("/forgot-password", forgotPassword);
authrouter.post("/reset-password", resetPassword);

// Sliding session — exchanges a still-valid token for a fresh one.
authrouter.get("/refresh", authMiddleware, refreshSession);

export default authrouter;
