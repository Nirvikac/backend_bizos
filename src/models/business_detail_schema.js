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
  },
  businessEmail: {
    type: String,
    required: true,
  },

  businessAddress: {
    type: String,
    required: true,
  },
  currency: {
    type: String,
    required: true,
    enum: ["NPR", "USD", "EUR", "INR"],
  },
  panNumber: {
    type: String,
    required: false,
  },
  vatNumber: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

//indexxing the ownerId field for faster queries
businessDetailSchema.index({ ownerId: 1 });
businessDetailSchema.index({ organizationName: 1 });

const businessDetail = mongoose.model("BusinessDetail", businessDetailSchema);
export default businessDetail;
