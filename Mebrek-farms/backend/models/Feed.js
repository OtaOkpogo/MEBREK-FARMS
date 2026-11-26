const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Feed quantity cannot be negative"],
      default: 0,
    },
    unit: {
      type: String,
      default: "bags",
      trim: true,
    },

    supplier: {
      type: String,
      trim: true,
      default: "",
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "lowStockThreshold cannot be negative"],
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    expiryDate: {
      type: Date,
      default: null,
    },

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
feedSchema.index({ isDeleted: 1, expiryDate: 1 });

feedSchema.index({
  name: "text",
  supplier: "text",
});

module.exports = mongoose.model("Feed", feedSchema);
