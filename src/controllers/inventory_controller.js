import Inventory from "../models/inventory_model.js";
import Product from "../models/product_schema.js";
import StockMovement from "../models/stock_movement_model.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";
import recordStockMovement from "../utils/record_stock_movement.js";

// Fields exposed when a product is embedded into an inventory response.
const PRODUCT_FIELDS = "name sku category sellingPrice costPrice unit images";

// A deleted product populates as null — its inventory is hidden from
// normal listings but the stock record stays for historical sales.
const isActiveInventory = (inv) => inv.productId != null;

const findBusinessInventory = (businessId, inventoryId) =>
  Inventory.findOne({ _id: inventoryId, businessId });

export const createInventory = async (req, res) => {
  try {
    const { productId, quantity, lowStockThreshold } = req.body;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID is required" });
    }

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    // Inventory can only be created for a product that's still live.
    const product = await Product.findOne({
      _id: productId,
      businessId: business._id,
      isActive: true,
    });

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // One stock record per product — the unique index also enforces this.
    const existing = await Inventory.findOne({
      businessId: business._id,
      productId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Inventory already exists for this product",
      });
    }

    const inventory = await Inventory.create({
      businessId: business._id,
      productId,
      quantity: quantity ?? 0,
      lowStockThreshold: lowStockThreshold ?? 5,
    });

    // Ledger: the starting stock level for this record.
    if ((quantity ?? 0) > 0) {
      await recordStockMovement({
        businessId: business._id,
        inventoryId: inventory._id,
        productId,
        type: "initial",
        change: quantity ?? 0,
        resultQuantity: quantity ?? 0,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Inventory created successfully",
      inventory,
    });
  } catch (error) {
    console.error("Create inventory error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create inventory" });
  }
};

export const getInventories = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const inventories = await Inventory.find({
      businessId: business._id,
    })
      .populate({
        path: "productId",
        match: { isActive: true },
        select: PRODUCT_FIELDS,
      })
      .lean();

    const activeInventories = inventories.filter(isActiveInventory);

    return res.status(200).json({
      success: true,
      count: activeInventories.length,
      inventories: activeInventories,
    });
  } catch (error) {
    console.error("Get inventories error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch inventories" });
  }
};

export const getInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const inventory = await Inventory.findOne({
      businessId: business._id,
      productId,
    }).populate({
      path: "productId",
      match: { isActive: true },
      select: PRODUCT_FIELDS,
    });

    if (!inventory || !isActiveInventory(inventory)) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory not found" });
    }

    return res.status(200).json({ success: true, inventory });
  } catch (error) {
    console.error("Get inventory error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch inventory" });
  }
};

// ────────────────────────────────────────────────────────────
// STOCK MOVEMENT LEDGER
//
// Append-only history of every stock change (sales, cancellations,
// restocks, manual adjustments). Newest first, paginated — the app shows
// this as a per-product stock timeline.
// ────────────────────────────────────────────────────────────
export const getStockMovements = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    // Scoped to the business so ids from other businesses return nothing.
    const inventory = await findBusinessInventory(business._id, inventoryId);

    if (!inventory) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory not found" });
    }

    const query = { inventoryId: inventory._id };

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StockMovement.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      count: movements.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      movements,
    });
  } catch (error) {
    console.error("Get stock movements error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch stock movements" });
  }
};

export const updateInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, lowStockThreshold } = req.body;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business not found" });
    }

    const inventory = await findBusinessInventory(business._id, inventoryId);

    if (!inventory) {
      return res
        .status(404)
        .json({ success: false, message: "Inventory not found" });
    }

    if (quantity !== undefined) {
      if (quantity < 0) {
        return res
          .status(400)
          .json({ success: false, message: "Quantity cannot be negative" });
      }

      // Ledger: manual edits are restock (up) or adjustment (down).
      const previousQuantity = inventory.quantity;
      inventory.quantity = quantity;

      const change = quantity - previousQuantity;
      if (change !== 0) {
        await recordStockMovement({
          businessId: business._id,
          inventoryId: inventory._id,
          productId: inventory.productId,
          type: change > 0 ? "restock" : "adjustment",
          change,
          resultQuantity: quantity,
          note:
            change > 0
              ? "Stock added manually"
              : "Stock removed manually",
        });
      }
    }

    if (lowStockThreshold !== undefined) {
      if (lowStockThreshold < 0) {
        return res.status(400).json({
          success: false,
          message: "Low stock threshold cannot be negative",
        });
      }

      inventory.lowStockThreshold = lowStockThreshold;
    }

    await inventory.save();

    const updatedInventory = await Inventory.findById(
      inventory._id,
    ).populate("productId", PRODUCT_FIELDS);

    return res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      inventory: updatedInventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update inventory" });
  }
};
