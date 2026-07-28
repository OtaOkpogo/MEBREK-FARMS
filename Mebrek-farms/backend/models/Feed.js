const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "quantity cannot be negative"],
    },

    unit: {
      type: String,
      default: "bags",
    },

    pricePerUnit: {
      type: Number,
      required: true,
      min: [0, "pricePerUnit cannot be negative"],
    },

    supplier: {
      type: String,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "lowStockThreshold cannot be negative"],
    },

    // NEW — when this batch of feed was bought, and when it goes bad.
    // Both optional: older records won't have either set, and not every
    // feed type necessarily has a known expiry.
    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

    // NEW
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: String,
      default: null,
    },

    deletedByRole: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

feedSchema.index({ createdAt: -1 });

feedSchema.index({ purchaseDate: -1 });

// Supports a "what's expiring soon" query without a full collection scan.
feedSchema.index({ isDeleted: 1, expiryDate: 1 });

feedSchema.index({
  name: "text",
  supplier: "text",
});

module.exports = mongoose.model("Feed", feedSchema);
