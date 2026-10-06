const mongoose = require("mongoose");

// ============================================================
// ATTACHMENT SCHEMA
// ============================================================

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
    },

    size: {
      type: Number,
      required: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: true,
  },
);

// ============================================================
// REPLY SCHEMA
// ============================================================

const replySchema = new mongoose.Schema(
  {
    // Optional because older notification records may
    // contain replies created before senderId was stored.
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    senderName: {
      type: String,
      trim: true,
      default: "",
    },

    senderRole: {
      type: String,
      trim: true,
      default: "",
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

// ============================================================
// NOTIFICATION SCHEMA
// ============================================================

const notificationSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    senderName: {
      type: String,
      trim: true,
      default: "",
    },

    senderRole: {
      type: String,
      trim: true,
      default: "",
    },

    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    recipientName: {
      type: String,
      default: null,
      trim: true,
    },

    subject: {
      type: String,
      trim: true,
      default: "",
    },

    message: {
      type: String,
      trim: true,
      default: "",
    },

    recipientRoles: {
      type: [String],
      default: ["manager", "superadmin"],
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    // ========================================================
    // PER-ADMIN READ STATE
    // ========================================================

    readBy: [
      {
        adminId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },

        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ========================================================
    // REPLIES
    // ========================================================

    replies: {
      type: [replySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Notification", notificationSchema);
