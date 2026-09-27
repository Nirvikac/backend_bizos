import mongoose from "mongoose";

/**
 * Append-only ledger of every stock change for an inventory record.
 *
 * The inventory document holds only the *current* quantity — this model
 * keeps the *story*: what changed, by how much, and why. Together they
 * let the app show a stock timeline per product.
 *
 * Movements are never updated or deleted (except when the parent
 * inventory record is removed).
 */
const stockMovementSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessDetail",
      required: true,
    },

    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // What kind of change happened.
    //  sale           — quantity left via a sale
    //  sale_cancelled — quantity returned by cancelling a sale
    //  restock        — quantity added manually (purchase / correction up)
    //  adjustment     — quantity removed manually (correction down, damage…)
    //  initial        — starting stock when the record was created
    type: {
      type: String,
      enum: ["sale", "sale_cancelled", "restock", "adjustment", "initial"],
      required: true,
    },

    // Signed delta: negative for stock leaving, positive for stock arriving.
    change: {
      type: Number,
      required: true,
    },

    // Quantity AFTER the change — lets the timeline show the running level
    // without replaying the whole ledger.
    resultQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    // Optional link back to the sale that caused the change.
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      default: null,
    },

    // Invoice number snapshot (survives sale deletion on cancel).
    invoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // Free-text context, e.g. who/why for manual adjustments.
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// The timeline query: newest first for one inventory record.
stockMovementSchema.index({ inventoryId: 1, createdAt: -1 });

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

export default StockMovement;
