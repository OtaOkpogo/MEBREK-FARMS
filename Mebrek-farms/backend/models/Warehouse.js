const mongoose = require("mongoose");

const warehouseSchema =
  new mongoose.Schema(
    {
      itemName: {
        type: String,
        required: true,
      },

      category: {
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

      location: {
        type: String,
      },

      status: {
        type: String,
        enum: [
          "In Stock",
          "Low Stock",
          "Out of Stock",
        ],
        default: "In Stock",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "Warehouse",
  warehouseSchema
);
