const mongoose = require("mongoose");

const birdHealthSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },
    penOrHouse: {
      type: String,
      required: [true, "Pen/House is required"],
      trim: true,
    },
    healthIssue: {
      type: String,
      required: [true, "Health issue / disease is required"],
      trim: true,
    },
    birdsAffected: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    symptoms: {
      type: String,
      trim: true,
      default: "",
    },
    severity: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Low",
    },
    vetConsulted: {
      type: Boolean,
      default: false,
    },
    diagnosis: {
      type: String,
      trim: true,
      default: "",
    },
    actionTaken: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["Under Treatment", "Recovered", "Isolated", "Dead"],
      default: "Under Treatment",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // Auto-set from the logged-in account at creation time — not a
    // manual form field, so it can't be spoofed as someone else.
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    // ---- Soft delete, matching the Medications/Warehouse pattern ----
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

birdHealthSchema.index({ isDeleted: 1, date: -1 });

module.exports = mongoose.model("BirdHealth", birdHealthSchema);
