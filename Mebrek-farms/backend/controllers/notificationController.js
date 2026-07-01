const router = require("express").Router();

const auth = require("../middleware/authMiddleware");

const {
  sendNotification,
  getNotifications,
  markAsRead,
  deleteNotification,
} = require("../controllers/notificationController");

router.post("/", auth, sendNotification);

router.get("/", auth, getNotifications);

router.put("/:id/read", auth, markAsRead);

router.delete("/:id", auth, deleteNotification);

module.exports = router;
