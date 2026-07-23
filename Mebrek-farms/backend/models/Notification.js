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

    // The manager this conversation belongs to.
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    recipientName: {
      type: String,
      default: null,
    },

    subject: String,

    message: {
      type: String,
      required: true,
      trim: true,
    },

    recipientRoles: {
      type: [String],
      default: ["manager", "superadmin"],
    },

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

notificationSchema.index({
  recipientRoles: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipientId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("Notification", notificationSchema);
