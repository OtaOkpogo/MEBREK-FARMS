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

const { protect } = require("../middleware/authMiddleware");

// GET /api/notifications/managers
router.get("/managers", protect, getManagers);

// GET /api/notifications/unread-count
router.get("/unread-count", protect, getUnreadCount);

// GET /api/notifications
router.get("/", protect, getNotifications);

// POST /api/notifications
router.post("/", protect, sendNotification);

// PUT /api/notifications/:id/read
router.put("/:id/read", protect, markAsRead);

// POST /api/notifications/:id/reply
router.post("/:id/reply", protect, replyNotification);

module.exports = router;
