const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
    },

    unit: {
      type: String,
      default: "bags",
    },

    location: {
      type: String,
      trim: true,
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    status: {
      type: String,
      enum: ["In Stock", "Low Stock", "Out of Stock"],
      default: "In Stock",
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
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Auto-derive status from quantity vs threshold
warehouseSchema.pre("save", function () {
  if (this.quantity <= 0) {
    this.status = "Out of Stock";
  } else if (this.quantity <= this.lowStockThreshold) {
    this.status = "Low Stock";
  } else {
    this.status = "In Stock";
  }
});

// Text index for global search
warehouseSchema.index({ itemName: "text", category: "text", location: "text" });

// Compound indexes for common queries
warehouseSchema.index({ category: 1, status: 1 });
warehouseSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("Warehouse", warehouseSchema);
