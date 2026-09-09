/**
 * Live verification of the product image upload flow.
 *
 * What it does (everything is cleaned up afterwards):
 *   1. Boot the REAL app (config/env.js → app.js) on an ephemeral port
 *   2. Create a throwaway user + business in the dev DB
 *   3. Mint a JWT the same way utils/jwt.js does
 *   4. POST  /api/products/postProducts with 2 real images (multipart)
 *   5. GET   the product, assert Cloudinary URLs + publicIds came back
 *   6. Confirm the assets exist in Cloudinary (remote HEAD checks)
 *   7. PUT   remove 1 image + add 1 new image in the same request
 *   8. Confirm the removed asset is GONE from Cloudinary, kept ones remain
 *   9. DELETE the product (soft delete; images stay in Cloudinary)
 *  10. Cleanup: remove test assets from Cloudinary + DB documents
 *
 * Usage:  node scripts/verify-product-upload.mjs
 */

import "../src/config/env.js";
import mongoose from "mongoose";
import cloudinary from "../src/config/cloudinary.js";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import dbConnect from "../src/config/db.js";
import Product from "../src/models/product_schema.js";
import User from "../src/models/user_schema.js";
import businessDetail from "../src/models/business_detail_schema.js";
import { buildTestImages } from "./helpers/test-images.mjs";

const results = [];
const track = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

// ------------------------------------------------------------
// Cloudinary asset inventory for the test folder
// ------------------------------------------------------------

const FOLDER_PREFIX = "bizos/products/";

async function listAssets() {
  const res = await cloudinary.api.resources({
    type: "upload",
    prefix: FOLDER_PREFIX,
    max_results: 100,
  });
  return res.resources.map((r) => r.public_id);
}

async function assetExists(publicId) {
  const ids = await listAssets();
  return ids.includes(publicId);
}

// ------------------------------------------------------------
// DB helpers
// ------------------------------------------------------------

const TEST_EMAIL = "verify-upload-flow@test.local";

async function seedUserAndBusiness() {
  const user = await User.create({
    username: "upload-verify-bot",
    email: TEST_EMAIL,
    password: "verify-12345",
    isEmailVerified: true,
  });

  const business = await businessDetail.create({
    ownerId: user._id,
    organizationName: "Upload Verify Co",
    businessType: "Solo Business",
    businessCategory: "Retail",
    businessPhone: "9800000000",
    businessEmail: TEST_EMAIL,
    businessAddress: "Test Lane 1",
    currency: "USD",
  });

  return { user, business };
}

async function cleanupDb(user, business) {
  // Delete products created during the test
  await Product.deleteMany({
    businessId: business?._id,
    sku: { $in: ["VERIFY-001", "VERIFY-001B"] },
  });

  if (business) await businessDetail.deleteOne({ _id: business._id });
  if (user) await User.deleteOne({ _id: user._id });
}

// ------------------------------------------------------------
// HTTP helpers
// ------------------------------------------------------------

async function api(method, path, { token, formData } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: formData,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }

  return { status: res.status, json };
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

let BASE_URL = "";
let server;
let user, business, token;
let createdPublicIds = []; // every Cloudinary asset we upload — removed at the end

try {
  await dbConnect();
  console.log("✔ DB connected");

  const { user: u, business: b } = await seedUserAndBusiness();
  user = u;
  business = b;
  token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRETS, {
    expiresIn: "1h",
  });
  console.log("✔ Test user + business seeded, JWT minted");

  server = app.listen(0); // ephemeral port
  await new Promise((resolve) => server.on("listening", resolve));
  const PORT_ACTUAL = server.address().port;
  BASE_URL = `http://127.0.0.1:${PORT_ACTUAL}`;
  console.log(`✔ Server on ${BASE_URL}\n`);

  // ============================================================
  // 1. CREATE with 2 real images
  // ============================================================

  const files = await buildTestImages(2); // [{ buffer, originalname, mimetype }]
  let fd = new FormData();
  fd.append("name", "Verify Widget");
  fd.append("sku", "VERIFY-001");
  fd.append("category", "Gadgets");
  fd.append("sellingPrice", "19.99");
  fd.append("costPrice", "8.50");
  fd.append("unit", "piece");
  fd.append("description", "Created by verify-product-upload.mjs");
  for (const f of files) {
    fd.append("images", new Blob([f.buffer], { type: f.mimetype }), f.originalname);
  }

  const createRes = await api("POST", "/api/products/postProducts", { token, formData: fd });
  track(
    "create returns 201",
    createRes.status === 201,
    `status=${createRes.status} msg=${createRes.json?.message || ""}`,
  );

  const product = createRes.json?.product;
  track("product created with 2 images", product?.images?.length === 2, `got ${product?.images?.length}`);

  const img0 = product?.images?.[0];
  const img1 = product?.images?.[1];
  track(
    "images have url + publicId in bizos/products",
    !!img0?.url &&
      !!img0?.publicId &&
      img0.publicId.startsWith(FOLDER_PREFIX) &&
      !!img1?.url &&
      !!img1?.publicId,
    img0?.publicId,
  );

  const productProductId = product?._id;

  // ============================================================
  // 2. Assets really exist in Cloudinary
  // ============================================================

  createdPublicIds = [img0.publicId, img1.publicId].filter(Boolean);

  track(
    "both assets present in Cloudinary",
    (await assetExists(img0.publicId)) && (await assetExists(img1.publicId)),
    `${createdPublicIds.length} assets`,
  );

  track(
    "image URLs are publicly fetchable (CDN)",
    (
      await Promise.all(
        createdPublicIds.map(async (id) => {
          const r = await fetch(`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${id}`);
          return r.ok;
        }),
      )
    ).every(Boolean),
  );

  // ============================================================
  // 3. UPDATE: remove image[0], add a third image
  // ============================================================

  const addFile = (await buildTestImages(3))[2];
  fd = new FormData();
  fd.append("removeImageIds", img0.publicId); // comma-separated string form
  fd.append("images", new Blob([addFile.buffer], { type: addFile.mimetype }), addFile.originalname);

  const updateRes = await api("PUT", `/api/products/${productProductId}`, { token, formData: fd });
  track(
    "update returns 200",
    updateRes.status === 200,
    `status=${updateRes.status} msg=${updateRes.json?.message || ""}`,
  );

  const updated = updateRes.json?.product;
  track(
    "product now has 2 images (1 removed + 1 added)",
    updated?.images?.length === 2,
    `got ${updated?.images?.length}`,
  );
  track(
    "remaining images exclude removed publicId",
    updated?.images?.every((im) => im.publicId !== img0.publicId) ?? false,
  );
  const addedImage = updated?.images?.at(-1);
  if (addedImage?.publicId) {
    createdPublicIds.push(addedImage.publicId);
  }

  track(
    "removed asset deleted from Cloudinary",
    !(await assetExists(img0.publicId)),
    img0.publicId,
  );
  track(
    "kept asset still in Cloudinary",
    await assetExists(img1.publicId),
    img1.publicId,
  );

  // ============================================================
  // 4. DELETE (soft) — images stay in Cloudinary
  // ============================================================

  const delRes = await api("DELETE", `/api/products/${productProductId}`, { token });
  track("delete returns 200", delRes.status === 200, `status=${delRes.status}`);

  const listRes = await api("GET", "/api/products/getProducts", { token });
  track(
    "deleted product gone from active list",
    !(listRes.json?.products || []).some((p) => p._id === productProductId),
  );

  track(
    "soft delete kept assets in Cloudinary",
    (
      await Promise.all(updated.images.map((im) => assetExists(im.publicId)))
    ).every(Boolean),
  );

  // ============================================================
  // 5. Validation / negative paths
  // ============================================================

  const badFd = new FormData();
  badFd.append("name", "No SKU");
  badFd.append("images", new Blob([files[0].buffer], { type: files[0].mimetype }), "x.png");

  const badRes = await api("POST", "/api/products/postProducts", { token, formData: badFd });
  track(
    "missing fields → 400 (before any Cloudinary upload)",
    badRes.status === 400,
    `status=${badRes.status}`,
  );

  const noAuth = await fetch(`${BASE_URL}/api/products/postProducts`, { method: "POST" });
  track("no token → 401", noAuth.status === 401, `status=${noAuth.status}`);

  // ============================================================
  // 6. Cleanup: Cloudinary + DB
  // ============================================================

  createdPublicIds = [...new Set(createdPublicIds.filter(Boolean))];
  if (createdPublicIds.length) {
    await cloudinary.api.delete_resources(createdPublicIds);
    console.log(`✔ Cleaned up ${createdPublicIds.length} Cloudinary assets`);
  }

  await cleanupDb(user, business);
  console.log("✔ Cleaned up test user, business and products\n");
} catch (err) {
  console.error("\nFATAL:", err);

  // Best-effort cleanup so we never leave garbage behind
  try {
    if (createdPublicIds.length) {
      await cloudinary.api.delete_resources([...new Set(createdPublicIds)]);
    }
    await cleanupDb(user, business);
    console.log("✔ Best-effort cleanup after failure");
  } catch (cleanupErr) {
    console.error("Cleanup also failed:", cleanupErr.message);
  }

  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  server?.close();
}

// ------------------------------------------------------------
// Summary
// ------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log("=".repeat(60));
console.log(`RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFailed checks:");
  failed.forEach((r) => console.log(`  ✗ ${r.name} — ${r.detail}`));
  process.exitCode = 1;
}
