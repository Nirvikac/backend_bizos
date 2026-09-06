import express from "express";

import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customer_controller.js";

import { authMiddleware } from "../middlewares/auth_middleware.js";

const customerRouter = express.Router();

// List customers
customerRouter.get("/", authMiddleware, getCustomers);

// Create customer
customerRouter.post("/", authMiddleware, createCustomer);

// Get single customer
customerRouter.get("/:customerId", authMiddleware, getCustomerById);

// Update customer
customerRouter.put("/:customerId", authMiddleware, updateCustomer);

// Delete customer
customerRouter.delete("/:customerId", authMiddleware, deleteCustomer);

export default customerRouter;
