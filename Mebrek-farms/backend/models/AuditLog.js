
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },

    actorName: {
      type: String,
      default: "Unknown User",
      trim: true,
    },

    actorEmail: {
      type: String,
      default: "Unknown",
      lowercase: true,
      trim: true,
    },

    actorRole: {
      type: String,
      enum: ["superadmin", "manager", "staff", "unknown"],
      default: "unknown",
      index: true,
    },

    action: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      enum: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "RESTORE",
        "LOGIN",
        "LOGOUT",
        "APPROVE",
        "REJECT",
        "EXPORT",
        "BACKUP",
        "ROLE_CHANGE",
        "PASSWORD_RESET",
        "STATUS_CHANGE",
        "OTHER",
      ],
    },

    module: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    entityName: {
      type: String,
      default: null,
      trim: true,
    },

    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    after: {
      type: mongoose.Schema.Types.Mixed,
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

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for audit history searches
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);

