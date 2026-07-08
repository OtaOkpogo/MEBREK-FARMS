const mongoose = require("mongoose");

const historyEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        "Created",
        "Edited",
        "Assigned",
        "Unassigned",
        "Condition Changed",
        "Checked Out",
        "Checked In",
        "Marked Missing",
        "Marked Found",
        "Maintenance",
        "Deleted",
      ],
      required: true,
    },
    note: String,
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const roomInventorySchema = new mongoose.Schema(
  {
    roomName: {
      type: String,
      required: true,
      trim: true,
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
      trim: true,
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
      min: 0,
    },

    condition: {
      type: String,
      enum: ["Excellent", "Good", "Fair", "Damaged", "Needs Repair"],
      default: "Good",
    },

    status: {
      type: String,
      enum: ["In Room", "Checked Out", "Missing", "Removed"],
      default: "In Room",
    },

    serialNumber: String,

    purchaseDate: Date,

    purchaseValue: Number,

    remarks: String,

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    history: [historyEventSchema],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("RoomInventory", roomInventorySchema);
