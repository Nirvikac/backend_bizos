import express from "express";

import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product_controller.js";

import { authMiddleware } from "../middlewares/auth_middleware.js";

const productsRouter = express.Router();

productsRouter.post("/postProducts", authMiddleware, createProduct);

productsRouter.get("/getProducts", authMiddleware, getProducts);

productsRouter.get("/:productId", authMiddleware, getProductById);

productsRouter.put("/:productId", authMiddleware, updateProduct);

productsRouter.delete("/:productId", authMiddleware, deleteProduct);

export default productsRouter;
