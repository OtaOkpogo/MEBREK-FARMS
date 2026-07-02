const mongoose = require("mongoose");

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

    message: String,

    isRead: {
      type: Boolean,
      default: false,
    },

    replies: [
      {
        senderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
        },

        senderName: String,

        senderRole: String,

        message: String,

        isRead: {
          type: Boolean,
          default: false,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Notification", notificationSchema);
