const mongoose = require("mongoose");

const cameraSchema = new mongoose.Schema(
  {
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

    // Used later when connecting the actual Hikvision NVR
    nvrIp: {
      type: String,
      trim: true,
      default: "",
    },

    rtspPort: {
      type: Number,
      default: 554,
    },

    // Keep credentials server-side.
    // Do NOT send these fields to the frontend.
    nvrUsername: {
      type: String,
      trim: true,
      default: "",
    },

    nvrPassword: {
      type: String,
      default: "",
    },

    // We will populate this after connecting the NVR
    streamUrl: {
      type: String,
      default: "",
    },

    // Camera management status
    isEnabled: {
      type: Boolean,
      default: true,
    },

    // Soft-delete support
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

// Useful indexes
cameraSchema.index({ name: 1 });
cameraSchema.index({ pen: 1 });
cameraSchema.index({ channel: 1 });
cameraSchema.index({ isEnabled: 1 });
cameraSchema.index({ isDeleted: 1 });

module.exports = mongoose.model("Camera", cameraSchema);
