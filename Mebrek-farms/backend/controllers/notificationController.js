const Admin = require("../models/Admin");
const Notification = require("../models/Notification");

// ======================
// Send Notification
// ======================
exports.sendNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const notification = await Notification.create({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      subject: req.body.subject || "General Message",
      message: req.body.message,
    });

    res.status(201).json(notification);
  } catch (err) {
    console.error(err);

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
        isRead: true,
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

// ======================
// Reply to Notification
// ======================
exports.replyNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    notification.replies.push({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      message: req.body.message,
    });

    await notification.save();

    res.json(notification);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
