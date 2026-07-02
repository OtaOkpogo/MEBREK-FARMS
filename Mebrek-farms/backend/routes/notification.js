const router = require("express").Router();

const protect = require("../middleware/authMiddleware");

const {
  sendNotification,
  getNotifications,
  markAsRead,
  replyNotification,
} = require("../controllers/notificationController");

router.post("/", protect, sendNotification);

router.post("/:id/reply", protect, replyNotification);

router.get("/", protect, getNotifications);

router.put("/:id/read", protect, markAsRead);

module.exports = router;
