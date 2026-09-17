import mongoose from "mongoose";
import Sale from "../models/sale.js";
import Product from "../models/product_schema.js";
import Inventory from "../models/inventory_model.js";
import Customer from "../models/customer_schema.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";

// Roll the transaction back and answer the client in one step, so no
// early return inside createSale/cancelSale can leave a session open.
const abortWith = async (session, res, status, message) => {
  await session.abortTransaction();
  return res.status(status).json({ success: false, message });
};

const createSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      items,
      customerId = null,
      customerName = "",
      customerPhone = "",
      discount = 0,
      tax = 0,
      paymentMethod = "Cash",
      paymentStatus = "Paid",
      paidAmount = 0,
      notes = "",
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return abortWith(session, res, 400, "Sale must contain at least one product");
    }

    if (discount < 0 || tax < 0) {
      return abortWith(
        session,
        res,
        400,
        "Discount and tax cannot be negative",
      );
    }

    if (paidAmount < 0) {
      return abortWith(
        session,
        res,
        400,
        "Paid amount cannot be negative",
      );
    }

    const business = await getOwnedBusiness(req.user.id, session);

    if (!business) {
      return abortWith(session, res, 404, "Business not found");
    }

    // The till sends a typed customer name — resolve it to a real Customer
    // record (or create one) so khata/history references an actual customer
    // instead of a name floating inside the notes.
    const resolvedCustomerId = await resolveCustomer(
      business._id,
      customerId,
      customerName,
      customerPhone,
      session,
    );

    if (resolvedCustomerId === null && customerId) {
      return abortWith(session, res, 404, "Customer not found");
    }

    const invoiceNumber = `INV-${Date.now()}`;

    const result = await processItems(business._id, items, session);

    if (result.error) {
      return abortWith(session, res, 400, result.error);
    }

    const { saleItems, subtotal } = result;

    const grandTotal = subtotal - discount + tax;

    if (grandTotal < 0) {
      return abortWith(session, res, 400, "Grand total cannot be negative");
    }

    const sale = await Sale.create(
      [
        {
          businessId: business._id,
          invoiceNumber,
          customerId: resolvedCustomerId,
          items: saleItems,
          subtotal,
          discount,
          tax,
          grandTotal,
          paymentMethod,
          paymentStatus,
          paidAmount,
          payments:
            paidAmount > 0
              ? [{ amount: paidAmount, method: paymentMethod }]
              : [],
          notes,
          saleDate: new Date(),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      sale: sale[0],
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Create sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sale",
    });
  } finally {
    session.endSession();
  }
};

/**
 * Finds an existing customer for this business (or creates one) and
 * returns their id. Returns null only when a supplied customerId doesn't
 * match — which the caller reports as 404.
 */
const resolveCustomer = async (
  businessId,
  customerId,
  customerName,
  customerPhone,
  session,
) => {
  if (customerId) {
    const existing = await Customer.findOne({
      _id: customerId,
      businessId,
    }).session(session);

    return existing ? existing._id : null;
  }

  const name = customerName.trim();
  if (!name) return null;

  const phone = customerPhone.trim();

  // Prefer phone, then exact name — avoids duplicate customers for the
  // same person when the name is typed slightly differently.
  let customer = null;

  if (phone) {
    customer = await Customer.findOne({ businessId, phone }).session(session);
  }

  customer ??= await Customer.findOne({ businessId, name }).session(session);

  if (!customer) {
    const [created] = await Customer.create([{ businessId, name, phone }], {
      session,
    });

    customer = created;
  }

  return customer._id;
};

/**
 * Validates each requested product, decrements its inventory, and builds
 * the sale item list. Returns { saleItems, subtotal } on success, or a
 * plain-string error message for the caller to send as 400/404.
 */
const processItems = async (businessId, items, session) => {
  const saleItems = [];
  let subtotal = 0;

  for (const item of items) {
    const { productId, quantity } = item;

    if (!productId || !quantity || quantity < 1) {
      return { error: "Invalid product or quantity" };
    }

    const product = await Product.findOne({
      _id: productId,
      businessId,
      isActive: true,
    }).session(session);

    if (!product) {
      return { error: `Product not found: ${productId}` };
    }

    const inventory = await Inventory.findOne({
      businessId,
      productId: product._id,
    }).session(session);

    if (!inventory) {
      return { error: `${product.name} does not have inventory` };
    }

    if (inventory.quantity < quantity) {
      return {
        error: `Insufficient stock for ${product.name}. Available: ${inventory.quantity}`,
      };
    }

    const unitPrice = product.sellingPrice;
    const total = unitPrice * quantity;

    subtotal += total;

    saleItems.push({
      productId: product._id,
      quantity,
      unitPrice,
      // Snapshot the cost so historical profit stays exact even if the
      // product's costPrice changes (or the product is deleted later).
      costPrice: product.costPrice ?? 0,
      total,
    });

    inventory.quantity -= quantity;
    await inventory.save({ session });
  }

  return { saleItems, subtotal };
};

const getSales = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const sales = await Sale.find({ businessId: business._id })
      .populate("customerId", "name phone email")
      .populate("items.productId", "name sku category sellingPrice unit images")
      .sort({ saleDate: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error("Get sales error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sales" });
  }
};

const getSaleById = async (req, res) => {
  try {
    const { saleId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      businessId: business._id,
    })
      .populate("customerId", "name phone email")
      .populate(
        "items.productId",
        "name sku category sellingPrice unit images",
      );

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    return res.status(200).json({ success: true, sale });
  } catch (error) {
    console.error("Get sale error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sale" });
  }
};

// Collect money owed on a partial/unpaid sale.
const recordPayment = async (req, res) => {
  try {
    const { saleId } = req.params;
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      businessId: business._id,
    });

    if (!sale) {
      return res
        .status(404)
        .json({ success: false, message: "Sale not found" });
    }

    const remaining = sale.grandTotal - sale.paidAmount;

    if (remaining <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "This sale is already fully paid" });
    }

    // Default to the sale's own method; callers can override (e.g. a cash
    // settlement of a credit sale).
    const method = req.body.method || sale.paymentMethod;
    const note = (req.body.note || "").trim();

    // Never let paidAmount exceed the grand total — record exactly what
    // was added so the payment history always sums to paidAmount.
    const added = Math.min(amount, remaining);

    sale.paidAmount += added;
    sale.paymentStatus =
      sale.paidAmount >= sale.grandTotal ? "Paid" : "Partial";

    sale.payments.push({
      amount: added,
      method,
      note,
      receivedAt: new Date(),
    });

    await sale.save();

    return res.status(200).json({
      success: true,
      message: "Payment received",
      sale,
    });
  } catch (error) {
    console.error("Record payment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record payment" });
  }
};

// Cancelling a sale puts the stock back and removes the record — it never
// happened, as far as inventory is concerned.
const cancelSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { saleId } = req.params;

    const business = await getOwnedBusiness(req.user.id, session);

    if (!business) {
      return abortWith(session, res, 404, "Business not found");
    }

    const sale = await Sale.findOne({
      _id: saleId,
      businessId: business._id,
    }).session(session);

    if (!sale) {
      return abortWith(session, res, 404, "Sale not found");
    }

    for (const item of sale.items) {
      const inventory = await Inventory.findOne({
        businessId: business._id,
        productId: item.productId,
      }).session(session);

      if (inventory) {
        inventory.quantity += item.quantity;
        await inventory.save({ session });
      }
    }

    await Sale.deleteOne({ _id: sale._id }).session(session);

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Sale cancelled and inventory restored",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Cancel sale error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel sale",
    });
  } finally {
    session.endSession();
  }
};

export { createSale, getSales, getSaleById, recordPayment, cancelSale };
