import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
  },

  isEmailVerified: {
    type: Boolean,
    default: false,
  },

  emailVerificationToken: {
    type: String,
    default: null,
  },

  emailVerificationTokenExpiry: {
    type: Date,
    default: null,
  },

  // Password reset uses its own hashed single-use token, kept separate from
  // email verification so the two flows can never clobber each other.
  passwordResetToken: {
    type: String,
    default: null,
  },

  passwordResetTokenExpiry: {
    type: Date,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

export default User;
