import express from "express";

import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "../controllers/expense_controller.js";

import { authMiddleware } from "../middlewares/auth_middleware.js";

const expenseRouter = express.Router();

// List expenses (supports ?from=&to=&category= filters)
expenseRouter.get("/", authMiddleware, getExpenses);

// Create expense
expenseRouter.post("/", authMiddleware, createExpense);

// Get single expense
expenseRouter.get("/:expenseId", authMiddleware, getExpenseById);

// Update expense
expenseRouter.put("/:expenseId", authMiddleware, updateExpense);

// Delete expense
expenseRouter.delete("/:expenseId", authMiddleware, deleteExpense);

export default expenseRouter;
