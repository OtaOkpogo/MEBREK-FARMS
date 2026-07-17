const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema(
  {
    medicationName: {
      type: String,
      required: [true, "Medication name is required"],
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
      default: "",
    },
    purpose: {
      type: String,
      trim: true,
      default: "",
    },
    administeredTo: {
      type: String,
      trim: true,
      default: "",
    },
    dateAdministered: {
      type: Date,
      default: Date.now,
    },
    administeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // ---- Soft delete, matching the Warehouse module pattern ----
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

// Speeds up the default "active records" list view and deleted-records view
medicationSchema.index({ isDeleted: 1, dateAdministered: -1 });

module.exports = mongoose.model("Medication", medicationSchema);

