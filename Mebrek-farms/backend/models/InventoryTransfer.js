const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
      index: true,
    },

    fromRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    toRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      validate: {
        validator: function (value) {
          return value.toString() !== this.fromRoom.toString();
        },
        message: "toRoom must be different from fromRoom",
      },
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },

    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "completed",
    },

    reason: String,
  },
  {
    timestamps: true,
  }
);

// Transfer history lookups: by item (item detail view) and by room (room activity log)
transferSchema.index({ item: 1, createdAt: -1 });
transferSchema.index({ fromRoom: 1, createdAt: -1 });
transferSchema.index({ toRoom: 1, createdAt: -1 });

module.exports = mongoose.model("InventoryTransfer", transferSchema);
