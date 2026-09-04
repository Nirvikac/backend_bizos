import express from "express";

// Register mongoose models referenced by other schemas (Sale → Customer)
// BEFORE any route/controller code that populates them runs.
import "./models/customer_schema.js";

import authrouter from "./routes/auth_routes.js";
import businessDetailsRouter from "./routes/business_details_route.js";
import productsRouter from "./routes/products_router.js";
import inventoryRoutes from "./routes/inventory_routes.js";
import saleRouter from "./routes/sale_routes.js";

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authrouter);
app.use("/api/businessDetails", businessDetailsRouter);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRoutes);

app.use("/api/sales", saleRouter);
export default app;
