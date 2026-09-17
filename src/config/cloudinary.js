import { v2 as cloudinary } from "cloudinary";

// Cloudinary credentials are optional at boot (the server can still serve
// non-image routes), but uploading without them must fail with a message
// that says exactly what to set.
const CLOUDINARY_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

export const getMissingCloudinaryEnvVars = () =>
  CLOUDINARY_ENV_VARS.filter((name) => !process.env[name]);

export const isCloudinaryConfigured = () =>
  getMissingCloudinaryEnvVars().length === 0;

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn(
    `[cloudinary] NOT CONFIGURED — missing env vars: ${getMissingCloudinaryEnvVars().join(", ")}. ` +
      "Product image upload will fail until these are set.",
  );
}

export default cloudinary;
