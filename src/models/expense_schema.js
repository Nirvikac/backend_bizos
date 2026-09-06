import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessDetail",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },

    // Free-text category (Rent, Salary, Electricity, Stock Purchase, etc.)
    category: {
      type: String,
      trim: true,
      default: "Other",
    },

    // Which payment method the money left by — mirrors the Sale schema enum
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Bank Transfer", "eSewa", "Khalti", "Other"],
      default: "Cash",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // The day the expense occurred (not when it was recorded)
    expenseDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Business expenses
expenseSchema.index({ businessId: 1 });

// Monthly reporting (dashboard totals)
expenseSchema.index({ businessId: 1, expenseDate: -1 });

const Expense = mongoose.model("Expense", expenseSchema);

export default Expense;