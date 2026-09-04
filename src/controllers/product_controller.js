import Product from "../models/product_schema.js";
import businessDetail from "../models/business_detail_schema.js";

// ============================================================
// CREATE PRODUCT
// ============================================================

export const createProduct = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      name,
      sku,
      description,
      category,
      sellingPrice,
      costPrice,
      unit,
      images,
    } = req.body;

    // --------------------------------------------------------
    // Validate required fields
    // --------------------------------------------------------

    if (!name || !sku || !category || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, SKU, category and selling price are required",
      });
    }

    // --------------------------------------------------------
    // Find business owned by authenticated user
    // --------------------------------------------------------

    const business = await businessDetail.findOne({
      ownerId: userId,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Check duplicate SKU within this business
    // --------------------------------------------------------

    const existingProduct = await Product.findOne({
      businessId: business._id,
      sku: sku.trim(),
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists",
      });
    }

    // --------------------------------------------------------
    // Create product
    // --------------------------------------------------------

    const product = await Product.create({
      businessId: business._id,
      name: name.trim(),
      sku: sku.trim(),
      description: description?.trim() || "",
      category: category.trim(),
      sellingPrice,
      costPrice: costPrice ?? 0,
      unit: unit?.trim() || "piece",
      images: images || [],
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create Product Error:", error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL PRODUCTS
// ============================================================

export const getProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    // --------------------------------------------------------
    // Find user's business
    // --------------------------------------------------------

    const business = await businessDetail.findOne({
      ownerId: userId,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Get products belonging to this business
    // --------------------------------------------------------

    const products = await Product.find({
      businessId: business._id,
      isActive: true,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get Products Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE PRODUCT
// ============================================================

export const getProductById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // --------------------------------------------------------
    // Find user's business
    // --------------------------------------------------------

    const business = await businessDetail.findOne({
      ownerId: userId,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Find product belonging to this business
    // --------------------------------------------------------

    const product = await Product.findOne({
      _id: productId,
      businessId: business._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE PRODUCT
// ============================================================

export const updateProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const {
      name,
      sku,
      description,
      category,
      sellingPrice,
      costPrice,
      unit,
      images,
    } = req.body;

    // --------------------------------------------------------
    // Find user's business
    // --------------------------------------------------------

    const business = await businessDetail.findOne({
      ownerId: userId,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Find product belonging to this business
    // --------------------------------------------------------

    const product = await Product.findOne({
      _id: productId,
      businessId: business._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // --------------------------------------------------------
    // Check SKU if it is being changed
    // --------------------------------------------------------

    if (sku && sku.trim() !== product.sku) {
      const existingProduct = await Product.findOne({
        businessId: business._id,
        sku: sku.trim(),
        _id: { $ne: productId },
      });

      if (existingProduct) {
        return res.status(409).json({
          success: false,
          message: "A product with this SKU already exists",
        });
      }

      product.sku = sku.trim();
    }

    // --------------------------------------------------------
    // Update fields
    // --------------------------------------------------------

    if (name !== undefined) {
      product.name = name.trim();
    }

    if (description !== undefined) {
      product.description = description.trim();
    }

    if (category !== undefined) {
      product.category = category.trim();
    }

    if (sellingPrice !== undefined) {
      product.sellingPrice = sellingPrice;
    }

    if (costPrice !== undefined) {
      product.costPrice = costPrice;
    }

    if (unit !== undefined) {
      product.unit = unit.trim();
    }

    if (images !== undefined) {
      product.images = images;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update Product Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A product with this SKU already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE PRODUCT
// ============================================================

export const deleteProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // --------------------------------------------------------
    // Find user's business
    // --------------------------------------------------------

    const business = await businessDetail.findOne({
      ownerId: userId,
    });

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Business details not found",
      });
    }

    // --------------------------------------------------------
    // Find product belonging to this business
    // --------------------------------------------------------

    const product = await Product.findOne({
      _id: productId,
      businessId: business._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // --------------------------------------------------------
    // Soft delete
    // --------------------------------------------------------

    product.isActive = false;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete Product Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};
