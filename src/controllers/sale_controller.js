import mongoose from "mongoose";
import Sale from "../../src/models/sale.js";
import Product from "../../src/models/product_schema.js";
import Inventory from "../../src/models/inventory_model.js";
import BusinessDetail from "../../src/models/business_detail_schema.js";
import Customer from "../../src/models/customer_schema.js";

// ============================================================
// CREATE SALE
// ============================================================

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

    // --------------------------------------------------------
    // 1. Validate items
    // --------------------------------------------------------

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Sale must contain at least one product",
      });
    }

    // --------------------------------------------------------
    // 2. Find business
    // --------------------------------------------------------

    const business = await BusinessDetail.findOne({
      ownerId: req.user.id,
    }).session(session);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    // --------------------------------------------------------
    // 3. Resolve the customer (real Customer record when possible)
    // --------------------------------------------------------

    // The till sends a typed customer name; find an existing customer for
    // this business or create one, so khata/history reference a real
    // Customer instead of a name floating inside the notes.
    let resolvedCustomerId = customerId;

    if (customerId) {
      const existing = await Customer.findOne({
        _id: customerId,
        businessId: business._id,
      }).session(session);

      if (!existing) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }
    } else if (customerName && customerName.trim()) {
      const name = customerName.trim();
      const phone = (customerPhone || "").trim();

      // Prefer phone, then exact name — avoids duplicate customers for the
      // same person when the name is typed slightly differently.
      let customer = null;

      if (phone) {
        customer = await Customer.findOne({
          businessId: business._id,
          phone,
        }).session(session);
      }

      if (!customer) {
        customer = await Customer.findOne({
          businessId: business._id,
          name,
        }).session(session);
      }

      if (!customer) {
        const created = await Customer.create(
          [
            {
              businessId: business._id,
              name,
              phone,
            },
          ],
          { session },
        );

        customer = created[0];
      }

      resolvedCustomerId = customer._id;
    }

    // --------------------------------------------------------
    // 4. Validate discount and tax
    // --------------------------------------------------------

    if (discount < 0 || tax < 0) {
      return res.status(400).json({
        success: false,
        message: "Discount and tax cannot be negative",
      });
    }

    // --------------------------------------------------------
    // 5. Generate invoice number
    // --------------------------------------------------------

    const invoiceNumber = `INV-${Date.now()}`;

    // --------------------------------------------------------
    // 6. Process sale items
    // --------------------------------------------------------

    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity < 1) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Invalid product or quantity",
        });
      }

      // ------------------------------------------------------
      // Find product belonging to this business
      // ------------------------------------------------------

      const product = await Product.findOne({
        _id: productId,
        businessId: business._id,
        isActive: true,
      }).session(session);

      if (!product) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: `Product not found: ${productId}`,
        });
      }

      // ------------------------------------------------------
      // Find inventory
      // ------------------------------------------------------

      const inventory = await Inventory.findOne({
        businessId: business._id,
        productId: product._id,
      }).session(session);

      if (!inventory) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: `${product.name} does not have inventory`,
        });
      }

      // ------------------------------------------------------
      // Check stock
      // ------------------------------------------------------

      if (inventory.quantity < quantity) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${inventory.quantity}`,
        });
      }

      // ------------------------------------------------------
      // Calculate item total
      // ------------------------------------------------------

      const unitPrice = product.sellingPrice;
      const total = unitPrice * quantity;

      subtotal += total;

      // ------------------------------------------------------
      // Add sale item
      // ------------------------------------------------------

      saleItems.push({
        productId: product._id,
        quantity,
        unitPrice,
        costPrice: product.costPrice ?? 0,
        total,
      });

      // ------------------------------------------------------
      // Decrease inventory
      // ------------------------------------------------------

      inventory.quantity -= quantity;

      await inventory.save({ session });
    }

    // --------------------------------------------------------
    // 7. Calculate final amount
    // --------------------------------------------------------

    const grandTotal = subtotal - discount + tax;

    if (grandTotal < 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Grand total cannot be negative",
      });
    }

    // --------------------------------------------------------
    // 8. Validate paid amount
    // --------------------------------------------------------

    if (paidAmount < 0) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "Paid amount cannot be negative",
      });
    }

    // --------------------------------------------------------
    // 9. Create sale
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // 10. Commit transaction
    // --------------------------------------------------------

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      sale: sale[0],
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Create Sale Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create sale",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// ============================================================
// GET ALL SALES
// ============================================================

const getSales = async (req, res) => {
  try {
    const business = await BusinessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const sales = await Sale.find({
      businessId: business._id,
    })
      .populate("customerId", "name phone email")
      .populate("items.productId", "name sku category sellingPrice unit images")
      .sort({ saleDate: -1 });

    return res.status(200).json({
      success: true,
      count: sales.length,
      sales,
    });
  } catch (error) {
    console.error("Get Sales Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sales",
      error: error.message,
    });
  }
};

// ============================================================
// GET SALE BY ID
// ============================================================

const getSaleById = async (req, res) => {
  try {
    const { saleId } = req.params;

    const business = await BusinessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
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
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    return res.status(200).json({
      success: true,
      sale,
    });
  } catch (error) {
    console.error("Get Sale Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get sale",
      error: error.message,
    });
  }
};

// ============================================================
// RECORD PAYMENT ON A SALE (collect money owed later)
// ============================================================

const recordPayment = async (req, res) => {
  try {
    const { saleId } = req.params;

    // Amount the customer is paying NOW, on top of any earlier payment.
    const amount = Number(req.body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than zero",
      });
    }

    const business = await BusinessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      businessId: business._id,
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // Already fully paid — nothing left to collect.
    const remaining = sale.grandTotal - sale.paidAmount;

    if (remaining <= 0) {
      return res.status(400).json({
        success: false,
        message: "This sale is already fully paid",
      });
    }

    // Payment method for this collection defaults to the sale's own method
    // (callers can override, e.g. a cash settlement of a credit sale).
    const method = req.body.method || sale.paymentMethod;
    const note = (req.body.note || "").trim();

    // Never let paidAmount exceed the grand total; record exactly what was
    // added so the payment history always sums to paidAmount.
    const added = Math.min(amount, remaining);

    sale.paidAmount = sale.paidAmount + added;

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
    console.error("Record Payment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to record payment",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE / CANCEL SALE
// ============================================================

const cancelSale = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { saleId } = req.params;

    const business = await BusinessDetail.findOne({
      ownerId: req.user.id,
    }).session(session);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const sale = await Sale.findOne({
      _id: saleId,
      businessId: business._id,
    }).session(session);

    if (!sale) {
      await session.abortTransaction();

      return res.status(404).json({
        success: false,
        message: "Sale not found",
      });
    }

    // --------------------------------------------------------
    // Return stock to inventory
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // Delete sale
    // --------------------------------------------------------

    await Sale.deleteOne({
      _id: sale._id,
    }).session(session);

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Sale cancelled and inventory restored",
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Cancel Sale Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to cancel sale",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

export { createSale, getSales, getSaleById, recordPayment, cancelSale };
