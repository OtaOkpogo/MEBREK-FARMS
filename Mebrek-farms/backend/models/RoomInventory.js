const mongoose = require("mongoose");

const roomInventorySchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
    },

    roomType: {
      type: String,
      enum: [
        "Staff Quarters",
        "Manager Residence",
        "Guest House",
        "Office",
        "Store",
        "Security Post",
        "Other",
      ],
      default: "Staff Quarters",
    },

    itemName: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      enum: [
        "Furniture",
        "Electronics",
        "Appliances",
        "Kitchen",
        "Cleaning",
        "Bedding",
        "Tools",
        "Other",
      ],
      default: "Furniture",
    },

    quantity: {
      type: Number,
      default: 1,
    },

    condition: {
      type: String,
      enum: [
        "Excellent",
        "Good",
        "Fair",
        "Damaged",
        "Needs Repair",
      ],
      default: "Good",
    },

    serialNumber: String,

    purchaseDate: Date,

    remarks: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("RoomInventory", roomInventorySchema);
