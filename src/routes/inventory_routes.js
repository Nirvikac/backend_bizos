import express from "express";

import {
  createInventory,
  getInventories,
  getInventoryByProduct,
  updateInventory,
  deleteInventory,
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

inventoryRouter.delete("/:inventoryId", authMiddleware, deleteInventory);

export default inventoryRouter;
