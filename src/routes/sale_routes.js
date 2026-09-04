import express from "express";

import {
  createSale,
  getSales,
  getSaleById,
  cancelSale,
} from "../controllers/sale_controller.js";

import { authMiddleware } from "../middlewares/auth_middleware.js";

const saleRouter = express.Router();

// Create sale
saleRouter.post("/", authMiddleware, createSale);

// Get all sales
saleRouter.get("/", authMiddleware, getSales);

// Get sale by ID
saleRouter.get("/:saleId", authMiddleware, getSaleById);

// Cancel sale
saleRouter.delete("/:saleId", authMiddleware, cancelSale);

export default saleRouter;
