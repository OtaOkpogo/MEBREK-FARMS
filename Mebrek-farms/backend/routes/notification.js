const router = require("express").Router();

const protect = require("../middleware/authMiddleware");

const {
  sendNotification,
  getNotifications,
  markAsRead,
} = require("../controllers/notificationController");

router.post("/", protect, sendNotification);

router.get("/", protect, getNotifications);

router.put("/:id/read", protect, markAsRead);

module.exports = router;
