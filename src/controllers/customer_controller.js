import mongoose from "mongoose";
import Customer from "../models/customer_schema.js";
import BusinessDetail from "../models/business_detail_schema.js";
import Sale from "../models/sale.js";

// ============================================================
// GET ALL CUSTOMERS
// ============================================================

export const getCustomers = async (req, res) => {
  try {
    const userId = req.user.id;

    const business = await BusinessDetail.findOne({ ownerId: userId });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    const customers = await Customer.find({
      businessId: business._id,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Get Customers Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE CUSTOMER
// ============================================================

export const getCustomerById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerId } = req.params;

    const business = await BusinessDetail.findOne({ ownerId: userId });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      businessId: business._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    console.error("Get Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

// ============================================================
// CREATE CUSTOMER
// ============================================================

export const createCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    const business = await BusinessDetail.findOne({ ownerId: userId });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Duplicate check: same phone (if given) or same name
    // --------------------------------------------------------

    const duplicateFilter = phone?.trim()
      ? { businessId: business._id, phone: phone.trim() }
      : { businessId: business._id, name: name.trim() };

    const existingCustomer = await Customer.findOne(duplicateFilter);

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "A customer with this phone number already exists",
        customer: existingCustomer,
      });
    }

    const customer = await Customer.create({
      businessId: business._id,
      name: name.trim(),
      phone: phone?.trim() || "",
      email: email?.trim() || "",
      address: address?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    console.error("Create Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE CUSTOMER
// ============================================================

export const updateCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerId } = req.params;
    const { name, phone, email, address } = req.body;

    const business = await BusinessDetail.findOne({ ownerId: userId });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      businessId: business._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    if (name !== undefined) {
      customer.name = name.trim();
    }
    if (phone !== undefined) {
      customer.phone = phone.trim();
    }
    if (email !== undefined) {
      customer.email = email.trim();
    }
    if (address !== undefined) {
      customer.address = address.trim();
    }

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE CUSTOMER
// ============================================================

export const deleteCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { customerId } = req.params;

    const business = await BusinessDetail.findOne({ ownerId: userId });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    const customer = await Customer.findOne({
      _id: customerId,
      businessId: business._id,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    // --------------------------------------------------------
    // Unlink from sales instead of cascading deletes, so sale
    // records stay intact (they become walk-in sales).
    // --------------------------------------------------------

    await Sale.updateMany(
      { businessId: business._id, customerId: customer._id },
      { $set: { customerId: null } },
    );

    await Customer.deleteOne({ _id: customer._id });

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    console.error("Delete Customer Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};
