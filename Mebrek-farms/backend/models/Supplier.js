const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },

    address: {
      type: String,
      trim: true,
    },

    // What this supplier sells, e.g. "Furniture", "Electrical", "Feed"
    // Kept as a free array of strings rather than a fixed enum since
    // suppliers can span categories and your category list may grow.
    productCategories: [
      {
        type: String,
        trim: true,
      },
    ],

    contactPerson: {
      name: String,
      phone: String,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    notes: String,

    // Performance fields — populated/recalculated later once PurchaseOrder
    // exists (Step 7.0.13). Stored here (rather than computed live every
    // request) so historical performance isn't retroactively distorted by
    // recalculation logic changes, and so dashboard reads are fast.
    performance: {
      totalOrders: { type: Number, default: 0 },
      lateDeliveries: { type: Number, default: 0 },
      averageDeliveryDays: { type: Number, default: 0 },
      qualityRating: { type: Number, min: 0, max: 100, default: null },
      lastCalculatedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

supplierSchema.index({ name: "text" });

module.exports = mongoose.model("Supplier", supplierSchema);
