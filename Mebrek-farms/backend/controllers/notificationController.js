const Notification = require("../models/Notification");

// ======================
// Send Notification
// ======================
exports.sendNotification = async (req, res) => {
  try {
    const notification = await Notification.create({
      sender: req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: req.body.message,
    });

    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ======================
// Get Notifications
// ======================
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ======================
// Mark as Read
// ======================
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        read: true,
      },
      {
        new: true,
      },
    );

    res.json(notification);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
