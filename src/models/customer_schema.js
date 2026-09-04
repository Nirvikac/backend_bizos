import mongoose from "mongoose";

const customerSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BusinessDetail",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
    default: "",
  },
  email: {
    type: String,
    trim: true,
    default: "",
  },
  address: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Faster lookups: customers belong to one business
customerSchema.index({ businessId: 1 });
customerSchema.index({ businessId: 1, phone: 1 });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
