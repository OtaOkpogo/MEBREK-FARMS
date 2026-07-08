const mongoose = require("mongoose");

const roomAuditSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },

    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    items: [
      {
        inventoryItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "InventoryItem",
        },

        expectedQuantity: Number,

        foundQuantity: Number,

        condition: {
          type: String,
          enum: ["Good", "Damaged", "Missing"],
          default: "Good",
        },

        remark: String,
      },
    ],

    score: {
      type: Number,
      min: 0,
      max: 100,
    },

    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "completed",
    },

    notes: String,
  },
  {
    timestamps: true,
  }
);

// Most recent audit per room, and audit history queries, both filter/sort by room + date
roomAuditSchema.index({ room: 1, createdAt: -1 });

module.exports = mongoose.model("RoomAudit", roomAuditSchema);
