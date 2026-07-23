const mongoose = require("mongoose");

const cameraSchema = new mongoose.Schema(
  {
    // =========================================
    // PUBLIC CAMERA INFORMATION
    // Safe to return to the frontend
    // =========================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Camera's associated farm pen
    pen: {
      type: String,
      required: true,
      trim: true,
    },

    // Hikvision NVR channel number
    channel: {
      type: Number,
      required: true,
      min: 1,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================================
    // PRIVATE NVR / STREAM CONFIGURATION
    // Never return these fields to the frontend
    // =========================================

    nvrIp: {
      type: String,
      trim: true,
      default: "",
    },

    rtspPort: {
      type: Number,
      default: 554,
    },

    // NVR credentials
    // select: false prevents these from being
    // returned by normal Mongoose queries
    nvrUsername: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    nvrPassword: {
      type: String,
      default: "",
      select: false,
    },

    // RTSP credentials
    // These are included now so the model is
    // ready for the actual stream integration.
    rtspUsername: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },

    rtspPassword: {
      type: String,
      default: "",
      select: false,
    },

    // Internal stream configuration.
    // Do not expose this if it contains credentials.
    streamUrl: {
      type: String,
      default: "",
      select: false,
    },

    // =========================================
    // CAMERA MANAGEMENT
    // =========================================

    isEnabled: {
      type: Boolean,
      default: true,
    },

    // =========================================
    // SOFT DELETE
    // =========================================

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

    deletedByName: {
      type: String,
      default: "",
    },

    deletedByRole: {
      type: String,
      default: "",
    },

    // =========================================
    // AUDIT INFORMATION
    // =========================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    createdByName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// =========================================
// INDEXES
// =========================================

cameraSchema.index({ name: 1 });
cameraSchema.index({ pen: 1 });
cameraSchema.index({ channel: 1 });
cameraSchema.index({ isEnabled: 1 });
cameraSchema.index({ isDeleted: 1 });

module.exports = mongoose.model("Camera", cameraSchema);
