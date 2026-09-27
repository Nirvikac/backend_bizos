import express from "express";

import {
  createInventory,
  getInventories,
  getInventoryByProduct,
  getStockMovements,
  updateInventory,
} from "../controllers/inventory_controller.js";

import { authMiddleware } from "../middlewares/auth_middleware.js";

const inventoryRouter = express.Router();

inventoryRouter.post("/", authMiddleware, createInventory);

inventoryRouter.get("/", authMiddleware, getInventories);

inventoryRouter.get(
  "/product/:productId",
  authMiddleware,
  getInventoryByProduct,
);

inventoryRouter.put("/:inventoryId", authMiddleware, updateInventory);

// Stock history timeline for one inventory record.
inventoryRouter.get(
  "/:inventoryId/movements",
  authMiddleware,
  getStockMovements,
);

export default inventoryRouter;
