import Expense from "../models/expense_schema.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";

const findBusinessExpense = (businessId, expenseId) =>
  Expense.findOne({ _id: expenseId, businessId });

export const createExpense = async (req, res) => {
  try {
    const { title, amount, category, paymentMethod, notes, expenseDate } =
      req.body;

    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Expense title is required" });
    }

    if (amount === undefined || amount === null || Number.isNaN(amount)) {
      return res
        .status(400)
        .json({ success: false, message: "Expense amount is required" });
    }

    if (amount < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount cannot be negative" });
    }

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const expense = await Expense.create({
      businessId: business._id,
      title: title.trim(),
      amount,
      category: category?.trim() || "Other",
      paymentMethod: paymentMethod || "Cash",
      notes: notes?.trim() || "",
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    console.error("Create expense error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create expense" });
  }
};

// Supports ?from=&to=&category= so the dashboard can pull any month.
export const getExpenses = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const filter = { businessId: business._id };

    if (req.query.from || req.query.to) {
      filter.expenseDate = {};

      if (req.query.from) {
        filter.expenseDate.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        filter.expenseDate.$lte = new Date(req.query.to);
      }
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    const expenses = await Expense.find(filter).sort({ expenseDate: -1 });

    return res.status(200).json({
      success: true,
      count: expenses.length,
      expenses,
    });
  } catch (error) {
    console.error("Get expenses error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch expenses" });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const expense = await findBusinessExpense(business._id, expenseId);

    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    return res.status(200).json({ success: true, expense });
  } catch (error) {
    console.error("Get expense error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch expense" });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { title, amount, category, paymentMethod, notes, expenseDate } =
      req.body;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const expense = await findBusinessExpense(business._id, expenseId);

    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    if (title !== undefined && !title.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Expense title cannot be empty" });
    }

    if (amount !== undefined) {
      if (Number.isNaN(amount) || amount < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Amount cannot be negative" });
      }

      expense.amount = amount;
    }

    if (title !== undefined) expense.title = title.trim();
    if (category !== undefined) expense.category = category.trim();
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (notes !== undefined) expense.notes = notes.trim();
    if (expenseDate !== undefined) expense.expenseDate = new Date(expenseDate);

    await expense.save();

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expense,
    });
  } catch (error) {
    console.error("Update expense error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update expense" });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const expense = await findBusinessExpense(business._id, expenseId);

    if (!expense) {
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    await Expense.deleteOne({ _id: expense._id });

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete expense error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete expense" });
  }
};
