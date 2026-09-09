import cloudinary, {
  isCloudinaryConfigured,
  getMissingCloudinaryEnvVars,
} from "../config/cloudinary.js";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const FOLDER = "bizos/products";
const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "gif"];

// ------------------------------------------------------------
// Upload a single image buffer to Cloudinary
// Returns { url, publicId } — matches Product.images subdocs
// ------------------------------------------------------------

export const uploadImage = async (buffer, originalName = "image") => {
  // Fail with an actionable message instead of a cryptic SDK error
  if (!isCloudinaryConfigured()) {
    throw new Error(
      `Cloudinary is not configured on this server. Missing env vars: ${getMissingCloudinaryEnvVars().join(", ")}`,
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: "image",
        // Normalize size on delivery without touching the original
        transformation: [{ width: 1200, height: 1200, crop: "limit" }],
        public_id: `${Date.now()}-${originalName.replace(/\.[^/.]+$/, "").replace(/\s+/g, "-")}`.slice(0, 100),
        allowed_formats: ALLOWED_FORMATS,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            new Error(error?.message || "Cloudinary upload failed"),
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    stream.end(buffer);
  });
};

// ------------------------------------------------------------
// Upload multiple image buffers (respects multer's file limit)
// ------------------------------------------------------------

export const uploadImages = async (files = []) => {
  const uploaded = [];

  for (const file of files) {
    uploaded.push(await uploadImage(file.buffer, file.originalname));
  }

  return uploaded;
};

// ------------------------------------------------------------
// Delete a single image from Cloudinary by publicId
// ------------------------------------------------------------

export const deleteImage = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });
  } catch (error) {
    // Never block the request because a CDN cleanup failed
    console.error(`Cloudinary delete failed for ${publicId}:`, error.message);
  }
};

// ------------------------------------------------------------
// Delete multiple images
// ------------------------------------------------------------

export const deleteImages = async (publicIds = []) => {
  await Promise.all(publicIds.map((publicId) => deleteImage(publicId)));
};

// ------------------------------------------------------------
// Delete only the images that were removed from a product
// (used on update so we don't destroy kept images)
// ------------------------------------------------------------

export const deleteRemovedImages = async (oldImages = [], newImages = []) => {
  const newPublicIds = new Set(newImages.map((img) => img.publicId));

  const removed = oldImages
    .filter((img) => !newPublicIds.has(img.publicId))
    .map((img) => img.publicId);

  await deleteImages(removed);
};
