const express = require("express");

const router = express.Router();

const {
  getManagers,
  getNotifications,
  sendNotification,
  getUnreadCount,
  markAsRead,
  replyNotification,
  getMessageRecipients,
} = require("../controllers/notificationController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  uploadNotificationAttachments,
} = require("../middleware/notificationUpload");

// ============================================================
// MESSAGE RECIPIENTS
// ============================================================

router.get(
  "/message-recipients",
  protect,
  allowRoles("superadmin", "manager"),
  getMessageRecipients,
);

// ============================================================
// MANAGERS
// ============================================================

router.get("/managers", protect, allowRoles("superadmin"), getManagers);

// ============================================================
// UNREAD COUNT
// ============================================================

router.get(
  "/unread-count",
  protect,
  allowRoles("superadmin", "manager"),
  getUnreadCount,
);

// ============================================================
// GET NOTIFICATIONS
// ============================================================

router.get("/", protect, allowRoles("superadmin", "manager"), getNotifications);

// ============================================================
// SEND NEW MESSAGE
// ============================================================

router.post(
  "/",
  protect,
  allowRoles("superadmin", "manager"),
  uploadNotificationAttachments,
  sendNotification,
);

// ============================================================
// MARK AS READ
// ============================================================

router.put(
  "/:id/read",
  protect,
  allowRoles("superadmin", "manager"),
  markAsRead,
);

// ============================================================
// REPLY
// ============================================================

router.post(
  "/:id/reply",
  protect,
  allowRoles("superadmin", "manager"),
  uploadNotificationAttachments,
  replyNotification,
);

module.exports = router;
