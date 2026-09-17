import mongoose from "mongoose";

const businessDetailSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  organizationName: {
    type: String,
    required: true,
    trim: true,
  },
  businessType: {
    type: String,
    required: true,
    enum: ["Solo Business", "Partnership", "Private Limited", "Public Limited"],
  },
  businessCategory: {
    type: String,
    required: true,
    enum: ["Wholesale", "Hardware", "Software", "Education", "Retail", "Other"],
  },
  businessPhone: {
    type: String,
    required: true,
    trim: true,
  },
  businessEmail: {
    type: String,
    required: true,
    trim: true,
  },
  businessAddress: {
    type: String,
    required: true,
    trim: true,
  },
  currency: {
    type: String,
    required: true,
    enum: ["NPR", "USD", "EUR", "INR"],
  },
  // Tax registration is optional — not every shop has one.
  panNumber: {
    type: String,
    trim: true,
    default: "",
  },
  vatNumber: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Every business-scoped query starts from the owner.
businessDetailSchema.index({ ownerId: 1 });

const BusinessDetail = mongoose.model("BusinessDetail", businessDetailSchema);

export default BusinessDetail;
