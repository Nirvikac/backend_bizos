import { v2 as cloudinary } from "cloudinary";

// ------------------------------------------------------------
// Required environment variables
// ------------------------------------------------------------

const CLOUDINARY_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

export const getMissingCloudinaryEnvVars = () =>
  CLOUDINARY_ENV_VARS.filter((name) => !process.env[name]);

export const isCloudinaryConfigured = () =>
  getMissingCloudinaryEnvVars().length === 0;

// ------------------------------------------------------------
// Configure the SDK only when every variable exists.
// (Passing undefined values used to cause "Must supply api_key"
// errors deep inside Cloudinary instead of a clear startup error.)
// ------------------------------------------------------------

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn(
    `[cloudinary] NOT CONFIGURED — missing environment variables: ${getMissingCloudinaryEnvVars().join(", ")}. ` +
      "Product image upload will fail until these are set (Render Dashboard → Environment).",
  );
}

export default cloudinary;
