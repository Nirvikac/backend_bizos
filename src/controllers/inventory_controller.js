import Inventory from "../models/inventory_model.js";
import Product from "../models/product_schema.js";
import businessDetail from "../models/business_detail_schema.js";

// ============================================================
// CREATE INVENTORY
// ============================================================

export const createInventory = async (req, res) => {
  try {
    const { productId, quantity, lowStockThreshold } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const business = await businessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    // Make sure product belongs to this business
    const product = await Product.findOne({
      _id: productId,
      businessId: business._id,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Prevent duplicate inventory
    const existingInventory = await Inventory.findOne({
      businessId: business._id,
      productId,
    });

    if (existingInventory) {
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

    return res.status(500).json({
      success: false,
      message: "Failed to create inventory",
    });
  }
};

// ============================================================
// GET ALL INVENTORY
// ============================================================

export const getInventories = async (req, res) => {
  try {
    const business = await businessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const inventories = await Inventory.find({
      businessId: business._id,
    }).populate(
      "productId",
      "name sku category sellingPrice costPrice unit images",
    );

    return res.status(200).json({
      success: true,
      count: inventories.length,
      inventories,
    });
  } catch (error) {
    console.error("Get inventories error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventories",
    });
  }
};

// ============================================================
// GET INVENTORY BY PRODUCT
// ============================================================

export const getInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const business = await businessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const inventory = await Inventory.findOne({
      businessId: business._id,
      productId,
    }).populate(
      "productId",
      "name sku category sellingPrice costPrice unit images",
    );

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    return res.status(200).json({
      success: true,
      inventory,
    });
  } catch (error) {
    console.error("Get inventory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
    });
  }
};

// ============================================================
// UPDATE INVENTORY
// ============================================================

export const updateInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;
    const { quantity, lowStockThreshold } = req.body;

    const business = await businessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const inventory = await Inventory.findOne({
      _id: inventoryId,
      businessId: business._id,
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({
          success: false,
          message: "Quantity cannot be negative",
        });
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

    const updatedInventory = await Inventory.findById(inventory._id).populate(
      "productId",
      "name sku category sellingPrice costPrice unit images",
    );

    return res.status(200).json({
      success: true,
      message: "Inventory updated successfully",
      inventory: updatedInventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update inventory",
    });
  }
};

// ============================================================
// DELETE INVENTORY
// ============================================================

export const deleteInventory = async (req, res) => {
  try {
    const { inventoryId } = req.params;

    const business = await businessDetail.findOne({
      ownerId: req.user.id,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business not found",
      });
    }

    const inventory = await Inventory.findOneAndDelete({
      _id: inventoryId,
      businessId: business._id,
    });

    if (!inventory) {
      return res.status(404).json({
        success: false,
        message: "Inventory not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inventory deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete inventory",
    });
  }
};
