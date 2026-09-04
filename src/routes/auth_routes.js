import express from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
} from "../controllers/auth_controller.js";
const authrouter = express.Router();

// Register route
authrouter.post("/register", registerUser);

// Login route
authrouter.post("/login", loginUser);

// Verification route
authrouter.get("/verify-email", verifyEmail);
export default authrouter;
