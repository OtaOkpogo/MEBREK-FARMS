const Admin = require("../models/Admin");
const Notification = require("../models/Notification");

const withReadState = (notification, adminId) => {
  const doc = notification.toObject ? notification.toObject() : notification;
  const isReadByMe = (doc.readBy || []).some(
    (entry) => entry.adminId?.toString() === adminId?.toString(),
  );
  return { ...doc, isReadByMe };
};

// ======================
// List managers (for the super admin "new conversation" picker)
// ======================
exports.getManagers = async (req, res) => {
  try {
    const managers = await Admin.find({ role: "manager" }).select("_id name");
    res.json(managers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Send Notification
// (find-or-create: continues the existing thread with that manager
// instead of spawning a new one, from either side)
// ======================
exports.sendNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: "User not found" });

    if (!req.body.message || !req.body.message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    let managerId;
    let recipient = null;

    if (admin.role === "manager") {
      managerId = admin._id;
    } else {
      // Super admin must target a specific manager
      if (!req.body.recipientId) {
        return res
          .status(400)
          .json({ message: "recipientId is required to start a conversation" });
      }

      recipient = await Admin.findById(req.body.recipientId);
      if (!recipient || recipient.role !== "manager") {
        return res
          .status(400)
          .json({ message: "recipientId must be an existing manager" });
      }
      managerId = recipient._id;
    }

    const io = req.app.get("io");

    // Does a thread with this manager already exist? If so, append as a reply.
    const existing = await Notification.findOne({
      $or: [
        { senderRole: "manager", senderId: managerId },
        { recipientId: managerId },
      ],
    }).sort({ createdAt: -1 });

    if (existing) {
      existing.replies.push({
        senderId: admin._id,
        senderName: admin.name,
        senderRole: admin.role,
        message: req.body.message.trim(),
      });
      existing.readBy = [{ adminId: admin._id, readAt: new Date() }];
      await existing.save();

      io.emit("notificationUpdated", withReadState(existing, req.user.id));
      return res.status(201).json(withReadState(existing, req.user.id));
    }

    const notification = await Notification.create({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      subject: req.body.subject || "General Message",
      message: req.body.message.trim(),
      recipientId: admin.role === "superadmin" ? managerId : null,
      recipientName: admin.role === "superadmin" ? recipient.name : undefined,
      recipientRoles: req.body.recipientRoles || ["manager", "superadmin"],
    });

    io.emit("notificationCreated", withReadState(notification, req.user.id));
    res.status(201).json(withReadState(notification, req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Get Notifications
// (manager sees only threads they're a party to; super admin sees all)
// ======================
exports.getNotifications = async (req, res) => {
  try {
    const role = req.user.role;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const roleVisible = {
      $or: [
        { recipientRoles: role },
        { recipientRoles: { $exists: false } },
        { recipientRoles: { $size: 0 } },
      ],
    };

    const filter =
      role === "manager"
        ? {
            $and: [
              roleVisible,
              {
                $or: [{ senderId: req.user.id }, { recipientId: req.user.id }],
              },
            ],
          }
        : roleVisible;

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
// ======================
exports.getUnreadCount = async (req, res) => {
  try {
    const role = req.user.role;

    const roleVisible = {
      $or: [
        { recipientRoles: role },
        { recipientRoles: { $exists: false } },
        { recipientRoles: { $size: 0 } },
      ],
    };

    const ownership =
      role === "manager"
        ? { $or: [{ senderId: req.user.id }, { recipientId: req.user.id }] }
        : {};

    const count = await Notification.countDocuments({
      $and: [
        roleVisible,
        ownership,
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
// ======================
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });

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
// (still used to continue a specific known thread — from the thread view
// or the popup — unchanged from before)
// ======================
exports.replyNotification = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).json({ message: "User not found" });

    if (!req.body.message || !req.body.message.trim()) {
      return res.status(400).json({ message: "Reply message is required" });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification)
      return res.status(404).json({ message: "Notification not found" });

    notification.replies.push({
      senderId: admin._id,
      senderName: admin.name,
      senderRole: admin.role,
      message: req.body.message.trim(),
    });

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
