import express from "express";

// Register mongoose models referenced by other schemas (Sale → Customer)
// before any route/controller code that populates them runs.
import "./models/customer_schema.js";

import authRouter from "./routes/auth_routes.js";
import businessDetailsRouter from "./routes/business_details_route.js";
import productsRouter from "./routes/products_router.js";
import inventoryRouter from "./routes/inventory_routes.js";
import saleRouter from "./routes/sale_routes.js";
import customerRouter from "./routes/customer_routes.js";
import expenseRouter from "./routes/expense_routes.js";

const app = express();

app.use(express.json());

// ── API routes ──────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/businessDetails", businessDetailsRouter);
app.use("/api/products", productsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/sales", saleRouter);
app.use("/api/customers", customerRouter);
app.use("/api/expenses", expenseRouter);

// ── Global error handler ────────────────────────────────────
// Last line of defense: multer/upload errors and bad bodies become clean
// JSON, everything else answers 500 without leaking internals.
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  // Multer errors (file too large, too many files, wrong field, bad type)
  if (error?.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller",
      LIMIT_FILE_COUNT: "A product can have at most 5 images",
      LIMIT_UNEXPECTED_FILE: "Only JPG, PNG, WEBP and GIF images are allowed",
    };

    return res.status(400).json({
      success: false,
      message: messages[error.code] || `Upload error: ${error.code}`,
    });
  }

  // Malformed multipart/form-data bodies
  if (error?.type === "entity.parse.failed" || error?.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid request body",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

export default app;
