import multer from "multer";

// ------------------------------------------------------------
// Storage: keep file in memory (buffer) so Cloudinary service
// can stream it. Nothing is written to disk.
// ------------------------------------------------------------

const storage = multer.memoryStorage();

// ------------------------------------------------------------
// File filter: accept images only
// ------------------------------------------------------------

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }

  cb(
    new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname),
    false,
  );
};

// ------------------------------------------------------------
// Limits
// ------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_IMAGES = 5;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_IMAGES,
  },
});

// Accept up to 5 images from the "images" field (multipart/form-data)
export const uploadProductImages = upload.array("images", MAX_IMAGES);

export default uploadProductImages;
