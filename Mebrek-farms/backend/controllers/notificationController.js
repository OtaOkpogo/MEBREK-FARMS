const mongoose = require("mongoose");
const fs = require("fs");

const Notification = require("../models/Notification");
const Admin = require("../models/Admin");

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (value._id) {
    return value._id.toString();
  }

  if (value.id) {
    return value.id.toString();
  }

  return value.toString();
};

// ============================================================
// CLEAN UP UPLOADED FILES
// ============================================================

const cleanupFiles = (files = []) => {
  files.forEach((file) => {
    if (!file?.path) return;

    fs.unlink(file.path, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error("Failed to remove uploaded file:", err.message);
      }
    });
  });
};

// ============================================================
// BUILD ATTACHMENT DATA
// ============================================================
//
// IMPORTANT:
// These names MUST match Notification.js:
//
// name
// type
// size
// fileName
// url
//
// ============================================================

const makeAttachmentData = (files = []) => {
  return files.map((file) => ({
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
    fileName: file.filename,
    url: `/uploads/notifications/${file.filename}`,
  }));
};

// ============================================================
// READ STATE
// ============================================================

const addReadState = (notification, adminId) => {
  const data = notification.toObject ? notification.toObject() : notification;

  const currentAdminId = getId(adminId);

  const readBy = Array.isArray(data.readBy) ? data.readBy : [];

  return {
    ...data,

    isReadByMe: readBy.some((item) => getId(item.adminId) === currentAdminId),
  };
};

// ============================================================
// GET MESSAGE RECIPIENTS
// ============================================================
//
// SUPERADMIN:
//   managers + other superadmins
//
// MANAGER:
//   active superadmins
//
// ============================================================

exports.getMessageRecipients = async (req, res) => {
  try {
    const currentRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();

    const currentAdminId = getId(req.admin?._id);

    let allowedRoles = [];

    if (currentRole === "superadmin") {
      allowedRoles = ["manager", "superadmin"];
    } else if (currentRole === "manager") {
      allowedRoles = ["superadmin"];
    } else {
      return res.status(403).json({
        message: "You are not authorized to message administrators.",
      });
    }

    const recipients = await Admin.find({
      status: "active",
      role: {
        $in: allowedRoles,
      },
      _id: {
        $ne: currentAdminId,
      },
    })
      .select("_id name email role")
      .sort({ name: 1 });

    return res.json(recipients);
  } catch (error) {
    console.error("GET MESSAGE RECIPIENTS ERROR:", error);

    return res.status(500).json({
      message: "Failed to load message recipients.",
    });
  }
};

// ============================================================
// GET MANAGERS
// ============================================================

exports.getManagers = async (req, res) => {
  try {
    const managers = await Admin.find({
      status: "active",
      role: "manager",
    })
      .select("_id name email role")
      .sort({ name: 1 });

    return res.json(managers);
  } catch (error) {
    console.error("GET MANAGERS ERROR:", error);

    return res.status(500).json({
      message: "Failed to load managers.",
    });
  }
};

// ============================================================
// GET NOTIFICATIONS
// ============================================================

exports.getNotifications = async (req, res) => {
  try {
    const currentAdminId = getId(req.admin?._id);

    const currentRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();

    let filter = {};

    // Superadmins can see all notification
    // conversations.
    if (currentRole === "superadmin") {
      filter = {};
    } else {
      // Managers see only conversations
      // involving themselves.
      filter = {
        $or: [
          {
            senderId: currentAdminId,
          },
          {
            recipientId: currentAdminId,
          },
        ],
      };
    }

    const notifications = await Notification.find(filter)
      .sort({
        updatedAt: -1,
        createdAt: -1,
      })
      .lean();

    const result = notifications.map((notification) =>
      addReadState(notification, currentAdminId),
    );

    return res.json(result);
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      message: "Failed to load notifications.",
    });
  }
};

// ============================================================
// GET UNREAD COUNT
// ============================================================

exports.getUnreadCount = async (req, res) => {
  try {
    const currentAdminId = getId(req.admin?._id);

    const filter = {
      $or: [
        {
          senderId: currentAdminId,
        },
        {
          recipientId: currentAdminId,
        },
      ],

      readBy: {
        $not: {
          $elemMatch: {
            adminId: currentAdminId,
          },
        },
      },
    };

    const count = await Notification.countDocuments(filter);

    return res.json({
      count,
    });
  } catch (error) {
    console.error("GET UNREAD COUNT ERROR:", error);

    return res.status(500).json({
      message: "Failed to get unread notification count.",
    });
  }
};

// ============================================================
// SEND NEW NOTIFICATION
// ============================================================

exports.sendNotification = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const senderId = getId(req.admin?._id);

    const senderName = req.admin?.name || "";

    const senderRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();

    const { recipientId, subject, message } = req.body || {};

    const trimmedMessage = String(message || "").trim();

    // ========================================================
    // VALIDATION
    // ========================================================

    if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
      cleanupFiles(uploadedFiles);

      return res.status(400).json({
        message: "A valid recipient is required.",
      });
    }

    if (senderRole !== "superadmin" && senderRole !== "manager") {
      cleanupFiles(uploadedFiles);

      return res.status(403).json({
        message: "You are not authorized to send notifications.",
      });
    }

    if (senderId === recipientId) {
      cleanupFiles(uploadedFiles);

      return res.status(400).json({
        message: "You cannot send a message to yourself.",
      });
    }

    const attachments = makeAttachmentData(uploadedFiles);

    if (!trimmedMessage && attachments.length === 0) {
      cleanupFiles(uploadedFiles);

      return res.status(400).json({
        message: "Enter a message or attach a file.",
      });
    }

    // ========================================================
    // VALID RECIPIENT ROLES
    // ========================================================

    const allowedRecipientRoles =
      senderRole === "manager" ? ["superadmin"] : ["manager", "superadmin"];

    const recipient = await Admin.findOne({
      _id: recipientId,
      status: "active",
      role: {
        $in: allowedRecipientRoles,
      },
    });

    if (!recipient) {
      cleanupFiles(uploadedFiles);

      return res.status(404).json({
        message: "The selected recipient is not available.",
      });
    }

    // ========================================================
    // CHECK EXISTING CONVERSATION
    // ========================================================

    const existing = await Notification.findOne({
      $or: [
        {
          senderId,
          recipientId,
        },
        {
          senderId: recipientId,
          recipientId: senderId,
        },
      ],
    }).sort({
      updatedAt: -1,
    });

    // ========================================================
    // EXISTING THREAD
    // ========================================================

    if (existing) {
      existing.replies.push({
        senderId,
        senderName,
        senderRole,
        message: trimmedMessage,
        attachments,
        createdAt: new Date(),
      });

      // Sender has read their own message.
      // Recipient becomes unread.
      existing.readBy = [
        {
          adminId: senderId,
          readAt: new Date(),
        },
      ];

      await existing.save();

      const responseNotification = addReadState(existing, senderId);

      const io = req.app.get("io");

      if (io) {
        io.emit("notificationUpdated", responseNotification);
      }

      return res.status(200).json({
        message: "Message sent successfully.",
        notification: responseNotification,
      });
    }

    // ========================================================
    // NEW THREAD
    // ========================================================

    const notification = await Notification.create({
      senderId,
      senderName,
      senderRole,

      recipientId: recipient._id,

      recipientName: recipient.name,

      subject: String(subject || "").trim(),

      message: trimmedMessage,

      recipientRoles: [recipient.role],

      attachments,

      readBy: [
        {
          adminId: senderId,
          readAt: new Date(),
        },
      ],

      replies: [],
    });

    const responseNotification = addReadState(notification, senderId);

    const io = req.app.get("io");

    if (io) {
      io.emit("notificationCreated", responseNotification);
    }

    return res.status(201).json({
      message: "Message sent successfully.",
      notification: responseNotification,
    });
  } catch (error) {
    cleanupFiles(uploadedFiles);

    console.error("SEND NOTIFICATION ERROR:", error);

    return res.status(500).json({
      message: error.message || "Failed to send notification.",
    });
  }
};

// ============================================================
// MARK AS READ
// ============================================================

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const currentAdminId = getId(req.admin?._id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    const existingIndex = notification.readBy.findIndex(
      (item) => getId(item.adminId) === currentAdminId,
    );

    if (existingIndex >= 0) {
      notification.readBy[existingIndex].readAt = new Date();
    } else {
      notification.readBy.push({
        adminId: currentAdminId,
        readAt: new Date(),
      });
    }

    await notification.save();

    return res.json({
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);

    return res.status(500).json({
      message: "Failed to mark notification as read.",
    });
  }
};

// ============================================================
// REPLY TO NOTIFICATION
// ============================================================

exports.replyNotification = async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const { id } = req.params;

    const currentAdminId = getId(req.admin?._id);

    const senderName = req.admin?.name || "";

    const senderRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();

    const { message } = req.body || {};

    const trimmedMessage = String(message || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      cleanupFiles(uploadedFiles);

      return res.status(400).json({
        message: "Invalid notification ID.",
      });
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      cleanupFiles(uploadedFiles);

      return res.status(404).json({
        message: "Notification not found.",
      });
    }

    const isParticipant =
      getId(notification.senderId) === currentAdminId ||
      getId(notification.recipientId) === currentAdminId;

    // Superadmin may access existing
    // notification threads.
    const isSuperadmin = senderRole === "superadmin";

    if (!isParticipant && !isSuperadmin) {
      cleanupFiles(uploadedFiles);

      return res.status(403).json({
        message: "You are not authorized to reply to this notification.",
      });
    }

    const attachments = makeAttachmentData(uploadedFiles);

    if (!trimmedMessage && attachments.length === 0) {
      cleanupFiles(uploadedFiles);

      return res.status(400).json({
        message: "Enter a reply or attach a file.",
      });
    }

    notification.replies.push({
      senderId: currentAdminId,
      senderName,
      senderRole,
      message: trimmedMessage,
      attachments,
      createdAt: new Date(),
    });

    // The sender has read the conversation.
    // Everyone else becomes unread.
    notification.readBy = [
      {
        adminId: currentAdminId,
        readAt: new Date(),
      },
    ];

    await notification.save();

    const responseNotification = addReadState(notification, currentAdminId);

    const io = req.app.get("io");

    if (io) {
      io.emit("notificationUpdated", responseNotification);
    }

    return res.status(200).json({
      message: "Reply sent successfully.",
      notification: responseNotification,
    });
  } catch (error) {
    cleanupFiles(uploadedFiles);

    console.error("REPLY NOTIFICATION ERROR:", error);

    return res.status(500).json({
      message: error.message || "Failed to send reply.",
    });
  }
};
