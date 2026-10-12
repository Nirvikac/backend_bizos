import express from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth_controller.js";
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

export default authrouter;
