const express = require("express");
const router = express.Router();

const {
  getManagers,
  getNotifications,
  sendNotification,
  getUnreadCount,
  markAsRead,
  replyNotification,
} = require("../controllers/notificationController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

// SUPERADMIN + MANAGER ONLY — Notifications.jsx explicitly shows staff
// "You don't have access to notifications" with no data at all. This
// is a manager<->superadmin inbox; staff was never meant to reach any
// of it, including via a direct API call. Previously these routes only
// checked authentication, so a staff account could pull full
// conversation content despite what the UI shows them.

// GET /api/notifications/managers
router.get("/managers", protect, allowRoles("superadmin"), getManagers);

// GET /api/notifications/unread-count
router.get(
  "/unread-count",
  protect,
  allowRoles("superadmin", "manager"),
  getUnreadCount,
);

// GET /api/notifications
router.get("/", protect, allowRoles("superadmin", "manager"), getNotifications);

// POST /api/notifications
router.post(
  "/",
  protect,
  allowRoles("superadmin", "manager"),
  sendNotification,
);

// PUT /api/notifications/:id/read
router.put(
  "/:id/read",
  protect,
  allowRoles("superadmin", "manager"),
  markAsRead,
);

// POST /api/notifications/:id/reply
router.post(
  "/:id/reply",
  protect,
  allowRoles("superadmin", "manager"),
  replyNotification,
);

module.exports = router;
