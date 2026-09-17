import Inventory from "../models/inventory_model.js";
import Product from "../models/product_schema.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";

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

      inventory.quantity = quantity;
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
