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
  },
  { timestamps: true },
);

// ================= INDEXES =================

// Sort by most recently added
feedSchema.index({ createdAt: -1 });

// Free-text search on name and supplier (the two string fields —
// quantity/pricePerUnit are numeric and don't belong in a text index)
feedSchema.index({ name: "text", supplier: "text" });

module.exports = mongoose.model("Feed", feedSchema);
