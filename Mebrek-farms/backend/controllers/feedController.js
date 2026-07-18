const Feed = require("../models/Feed");
const Admin = require("../models/Admin");

// ================= CREATE FEED =================
exports.createFeed = async (req, res) => {
  try {
    const feed = await Feed.create(req.body);

    // Socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("feedCreated", feed);
    }

    res.status(201).json(feed);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= GET FEEDS =================
exports.getFeeds = async (req, res) => {
  try {
    let feeds;

    if (req.user?.role === "superadmin") {
      // Super Admin sees everything
      feeds = await Feed.find().sort({ createdAt: -1 });
    } else {
      // Others don't see deleted feeds
      feeds = await Feed.find({
        isDeleted: false,
      }).sort({ createdAt: -1 });
    }

    res.json(feeds);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= UPDATE FEED =================
exports.updateFeed = async (req, res) => {
  try {
    const feed = await Feed.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!feed) {
      return res.status(404).json({
        error: "Feed not found",
      });
    }

    const io = req.app.get("io");

    if (io) {
      io.emit("feedUpdated", feed);
    }

    res.json(feed);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= DELETE FEED (SOFT DELETE) =================
exports.deleteFeed = async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.id);

    if (!feed) {
      return res.status(404).json({
        error: "Feed not found",
      });
    }

    feed.isDeleted = true;
    feed.deletedAt = new Date();

    if (req.user) {
      const admin = await Admin.findById(req.user.id);

      if (admin) {
        feed.deletedBy = admin.name;
        feed.deletedByRole = admin.role;
      } else {
        feed.deletedBy = "Unknown";
        feed.deletedByRole = "";
      }
    }

    await feed.save();

    const io = req.app.get("io");

    if (io) {
      io.emit("feedDeleted", feed);
    }

    res.json({
      message: "Feed deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};
