const Admin = require("../models/Admin");
const Notification = require("../models/Notification");

// Shape a notification for a specific viewer: adds `isReadByMe`
// instead of leaking the raw readBy array's meaning as a global flag.
const withReadState = (notification, adminId) => {
  const doc = notification.toObject ? notification.toObject() : notification;

  const isReadByMe = (doc.readBy || []).some(
    (entry) => entry.adminId?.toString() === adminId?.toString(),
  );

  return { ...doc, isReadByMe };
};

// ======================
// Send Notification
// ======================
exports.sendNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!req.body.message || !req.body.message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    const notification = await Notification.create({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      subject: req.body.subject || "General Message",
      message: req.body.message.trim(),
      recipientRoles: req.body.recipientRoles || ["manager", "superadmin"],
    });

    const io = req.app.get("io");
    io.emit("notificationCreated", withReadState(notification, req.user.id));

    res.status(201).json(withReadState(notification, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Get Notifications
// (role-filtered, paginated, includes per-user read state)
// ======================
exports.getNotifications = async (req, res) => {
  try {
    const role = req.user.role;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const filter = {
      $or: [
        { recipientRoles: role },
        { recipientRoles: { $exists: false } },
        { recipientRoles: { $size: 0 } },
      ],
    };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(filter),
    ]);

    res.json({
      data: notifications.map((n) => withReadState(n, req.user.id)),
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Get Unread Count
// (for the bell icon / toast bar badge — cheap query, no full list)
// ======================
exports.getUnreadCount = async (req, res) => {
  try {
    const role = req.user.role;

    const count = await Notification.countDocuments({
      $and: [
        {
          $or: [
            { recipientRoles: role },
            { recipientRoles: { $exists: false } },
            { recipientRoles: { $size: 0 } },
          ],
        },
        { "readBy.adminId": { $ne: req.user.id } },
      ],
    });

    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Mark as Read
// (per-admin — does not affect other admins' read state)
// ======================
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const alreadyRead = notification.readBy.some(
      (entry) => entry.adminId?.toString() === req.user.id,
    );

    if (!alreadyRead) {
      notification.readBy.push({ adminId: req.user.id, readAt: new Date() });
      await notification.save();
    }

    const io = req.app.get("io");
    io.emit("notificationUpdated", withReadState(notification, req.user.id));

    res.json(withReadState(notification, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Reply to Notification
// (a new reply makes the thread unread again for everyone but the replier)
// ======================
exports.replyNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!req.body.message || !req.body.message.trim()) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    notification.replies.push({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      message: req.body.message.trim(),
    });

    // Reopen the thread: only the replier keeps it marked read.
    notification.readBy = [{ adminId: admin._id, readAt: new Date() }];

    await notification.save();

    const io = req.app.get("io");
    io.emit("notificationUpdated", withReadState(notification, req.user.id));

    res.json(withReadState(notification, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};
