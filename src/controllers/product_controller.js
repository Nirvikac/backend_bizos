import Product from "../models/product_schema.js";
import businessDetail from "../models/business_detail_schema.js";
import {
  uploadImages,
  deleteRemovedImages,
} from "../services/cloudinary.service.js";

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
    // Upload images to Cloudinary (from multer memory storage)
    // --------------------------------------------------------

    let images = [];

    if (req.files?.length) {
      images = await uploadImages(req.files);
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
      images,
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
      removeImageIds,
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
    // Handle images:
    // 1. Delete removed images (by publicId) from Cloudinary
    // 2. Upload newly added files
    // --------------------------------------------------------

    let nextImages = [...product.images];

    // 1. Remove images the client asked to delete
    //    Accepts a JSON array or a comma-separated string of publicIds
    if (removeImageIds !== undefined) {
      let removedIds = [];

      if (Array.isArray(removeImageIds)) {
        removedIds = removeImageIds;
      } else if (typeof removeImageIds === "string" && removeImageIds.trim()) {
        removedIds = removeImageIds.split(",").map((id) => id.trim());
      }

      if (removedIds.length) {
        nextImages = nextImages.filter(
          (img) => !removedIds.includes(img.publicId),
        );
      }
    }

    // 2. Upload new files and append
    if (req.files?.length) {
      const uploadedImages = await uploadImages(req.files);
      nextImages.push(...uploadedImages);
    }

    // --------------------------------------------------------
    // Update text fields
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

    // --------------------------------------------------------
    // Persist image changes, then clean up Cloudinary for
    // images that were dropped (DB is the source of truth)
    // --------------------------------------------------------

    if (
      removeImageIds !== undefined ||
      req.files?.length
    ) {
      const oldImages = [...product.images];

      product.images = nextImages;
      await product.save();

      await deleteRemovedImages(oldImages, nextImages);
    } else {
      await product.save();
    }

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
    // Soft delete — keep Cloudinary images intact so the
    // product can be restored with its images in the future
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
