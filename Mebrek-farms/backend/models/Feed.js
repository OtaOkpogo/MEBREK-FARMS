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

feedSchema.index({
  name: "text",
  supplier: "text",
});

module.exports = mongoose.model("Feed", feedSchema);
