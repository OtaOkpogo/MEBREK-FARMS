const mongoose = require("mongoose");

const loginActivitySchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    name: {
      type: String,
      default: "Unknown User",
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    role: {
      type: String,
      enum: ["superadmin", "manager", "staff", "unknown"],
      default: "unknown",
    },

    status: {
      type: String,
      enum: ["success", "failed", "blocked"],
      required: true,
    },

    failureReason: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      default: "Unknown",
    },

    userAgent: {
      type: String,
      default: "Unknown",
    },
  },
  {
    timestamps: true,
  },
);

loginActivitySchema.index({ createdAt: -1 });
loginActivitySchema.index({ email: 1, createdAt: -1 });
loginActivitySchema.index({ role: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("LoginActivity", loginActivitySchema);
