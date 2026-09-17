import Product from "../models/product_schema.js";
import {
  uploadImages,
  deleteRemovedImages,
} from "../services/cloudinary.service.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";

const DUPLICATE_SKU_MESSAGE = "A product with this SKU already exists";

// The product's business, asserted in one place for every handler.
const findBusinessProduct = (businessId, productId) =>
  Product.findOne({ _id: productId, businessId });

// removeImageIds arrives as a JSON array (JSON body) or a comma-separated
// string (multipart form data). Normalize both to an array of ids.
const parseRemovedImageIds = (removeImageIds) => {
  if (Array.isArray(removeImageIds)) {
    return removeImageIds.map(String);
  }

  if (typeof removeImageIds === "string" && removeImageIds.trim()) {
    return removeImageIds.split(",").map((id) => id.trim());
  }

  return [];
};

export const createProduct = async (req, res) => {
  try {
    const { name, sku, description, category, sellingPrice, costPrice, unit } =
      req.body;

    if (!name || !sku || !category || sellingPrice === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, SKU, category and selling price are required",
      });
    }

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    // SKU is unique per business — check up front so the user gets a
    // friendly conflict message instead of a raw index error.
    const existingProduct = await Product.findOne({
      businessId: business._id,
      sku: sku.trim(),
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_SKU_MESSAGE,
      });
    }

    const images = req.files?.length ? await uploadImages(req.files) : [];

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
    console.error("Create product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_SKU_MESSAGE,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

export const getProducts = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    // Soft-deleted products stay out of the list (but remain in the DB
    // so old sales and inventory records keep pointing at something).
    const products = await Product.find({
      businessId: business._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch products" });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { productId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const product = await findBusinessProduct(business._id, productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Get product error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch product" });
  }
};

export const updateProduct = async (req, res) => {
  try {
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

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const product = await findBusinessProduct(business._id, productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Only care about the SKU when it's actually being changed.
    if (sku !== undefined && sku.trim() !== product.sku) {
      const skuTaken = await Product.findOne({
        businessId: business._id,
        sku: sku.trim(),
        _id: { $ne: productId },
      });

      if (skuTaken) {
        return res.status(409).json({
          success: false,
          message: DUPLICATE_SKU_MESSAGE,
        });
      }

      product.sku = sku.trim();
    }

    // Images: DB first, Cloudinary second. The save is the source of
    // truth — if cleanup afterwards fails, orphaned CDN files are
    // annoying but harmless; the reverse order would be worse.
    let nextImages = [...product.images];

    if (removeImageIds !== undefined) {
      const removedIds = parseRemovedImageIds(removeImageIds);

      if (removedIds.length) {
        nextImages = nextImages.filter(
          (img) => !removedIds.includes(img.publicId),
        );
      }
    }

    if (req.files?.length) {
      nextImages.push(...(await uploadImages(req.files)));
    }

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description.trim();
    if (category !== undefined) product.category = category.trim();
    if (sellingPrice !== undefined) product.sellingPrice = sellingPrice;
    if (costPrice !== undefined) product.costPrice = costPrice;
    if (unit !== undefined) product.unit = unit.trim();

    const imagesChanged =
      removeImageIds !== undefined || req.files?.length > 0;

    if (imagesChanged) {
      const oldImages = [...product.images];

      product.images = nextImages;
      await product.save();

      // Fire and forget-ish: failures are logged inside the service and
      // must not fail the update.
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
    console.error("Update product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: DUPLICATE_SKU_MESSAGE,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
};

// Soft delete: sales and inventory reference products by id, so the
// document stays. It simply disappears from active lists.
export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res
        .status(404)
        .json({ success: false, message: "Business details not found" });
    }

    const product = await findBusinessProduct(business._id, productId);

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    product.isActive = false;
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete product" });
  }
};
