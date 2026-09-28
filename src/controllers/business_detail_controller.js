import businessDetail from "../models/business_detail_schema.js";
import getOwnedBusiness from "../utils/getOwnedBusiness.js";
import { uploadQrImage, deleteImage } from "../services/cloudinary.service.js";

// Onboarding: the signed-up user tells us about their shop. One user
// owns one business, which every other module scopes its queries to.
const createBusinessDetails = async (req, res) => {
  try {
    const {
      organizationName,
      businessType,
      businessCategory,
      businessPhone,
      businessEmail,
      businessAddress,
      currency,
      panNumber,
      vatNumber,
    } = req.body;

    const business = await businessDetail.create({
      ownerId: req.user.id,
      organizationName,
      businessType,
      businessCategory,
      businessPhone,
      businessEmail,
      businessAddress,
      currency,
      panNumber,
      vatNumber,
    });

    return res.status(201).json({
      success: true,
      message: "Business details created successfully",
      businessDetail: business,
    });
  } catch (error) {
    console.error("Create business details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save business details",
    });
  }
};

const getBusinessDetails = async (req, res) => {
  try {
    const business = await businessDetail
      .find({ ownerId: req.user.id })
      .lean();

    // Empty array = the user hasn't onboarded yet. The frontend treats
    // this 404 as "show the onboarding form".
    if (!business || business.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No business details found for this user.",
      });
    }

    return res.status(200).json(business);
  } catch (error) {
    console.error("Get business details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch business details",
    });
  }
};

// ------------------------------------------------------------
// Payment QR — stored on the business document so it is always
// scoped to the owner, one QR per business.
// ------------------------------------------------------------

const getPaymentQr = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "No business details found for this user.",
      });
    }

    const qr = business.paymentQr?.url ? business.paymentQr : null;

    return res.status(200).json({
      success: true,
      paymentQr: qr,
    });
  } catch (error) {
    console.error("Get payment QR error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment QR",
    });
  }
};

// Upload (or replace) the business payment QR. Multipart/form-data with
// a single "qr" image file; the previous Cloudinary asset is deleted.
const uploadPaymentQr = async (req, res) => {
  try {
    const business = await getOwnedBusiness(req.user.id);

    if (!business) {
      return res.status(404).json({
        success: false,
        message: "Set up your business details before uploading a QR.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a QR image to upload",
      });
    }

    const previous = business.paymentQr?.publicId
      ? { publicId: business.paymentQr.publicId }
      : null;

    const uploaded = await uploadQrImage(req.file.buffer);

    business.paymentQr = {
      url: uploaded.url,
      publicId: uploaded.publicId,
    };
    await business.save();

    // Only remove the old asset after the new one is safely saved.
    if (previous) {
      await deleteImage(previous.publicId);
    }

    return res.status(200).json({
      success: true,
      message: "Payment QR updated",
      paymentQr: business.paymentQr,
    });
  } catch (error) {
    console.error("Upload payment QR error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to upload payment QR",
    });
  }
};

export { createBusinessDetails, getBusinessDetails, getPaymentQr, uploadPaymentQr };
