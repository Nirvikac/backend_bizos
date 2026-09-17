import Customer from "../models/customer_schema.js";
import Sale from "../models/sale.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";

// Find the customer within one business, or null.
const findBusinessCustomer = (businessId, customerId) =>
  Customer.findOne({ _id: customerId, businessId });

export const getCustomers = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const customers = await Customer.find({
      businessId: business._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers,
    });
  } catch (error) {
    console.error("Get customers error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch customers" });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { customerId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const customer = await findBusinessCustomer(business._id, customerId);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error("Get customer error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch customer" });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;

    if (!name?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Customer name is required" });
    }

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    // Same person twice: match on phone when given, otherwise name.
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
    console.error("Create customer error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create customer" });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { name, phone, email, address } = req.body;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const customer = await findBusinessCustomer(business._id, customerId);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    if (name !== undefined) customer.name = name.trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (email !== undefined) customer.email = email.trim();
    if (address !== undefined) customer.address = address.trim();

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update customer error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update customer" });
  }
};

// Deleting a customer never touches their sales — the sale records are
// unlinked instead and simply become walk-in sales.
export const deleteCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const customer = await findBusinessCustomer(business._id, customerId);

    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

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
    console.error("Delete customer error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete customer" });
  }
};
