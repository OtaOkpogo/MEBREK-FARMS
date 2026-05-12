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
    },

    unit: {
      type: String,
      default: "bags",
    },

    pricePerUnit: {
      type: Number,
      required: true,
    },

    supplier: {
      type: String,
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feed", feedSchema);
