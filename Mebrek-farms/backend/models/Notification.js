const mongoose = require("mongoose");

const replySchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    senderName: String,

    senderRole: String,

    message: String,

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const notificationSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    senderName: String,

    senderRole: String,

    subject: String,

    message: {
      type: String,
      required: true,
      trim: true,
    },

    // add inside notificationSchema fields:
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    recipientName: String,

    // Who this notification is addressed to.
    // Defaults to manager + superadmin — staff never see notifications.
    recipientRoles: {
      type: [String],
      default: ["manager", "superadmin"],
    },

    // Per-admin read tracking (replaces the old flat `isRead` boolean).
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

    replies: [replySchema],
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({
  subject: "text",
  message: "text",
  senderName: "text",
});

notificationSchema.index({ recipientRoles: 1, createdAt: -1 });
// add alongside the existing indexes:
notificationSchema.index({ recipientId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
