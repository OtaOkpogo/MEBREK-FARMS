const Feed = require("../models/Feed");
const Admin = require("../models/Admin");
const { logAudit } = require("../utils/auditLogger");

// =====================================================
// AUDIT HELPERS
// =====================================================

const getFeedAuditSnapshot = (feed) => {
  if (!feed) return null;

  const snapshot =
    typeof feed.toObject === "function" ? feed.toObject() : { ...feed };

  // Remove internal Mongoose metadata.
  delete snapshot.__v;

  return snapshot;
};

const getFeedName = (feed) => {
  return (
    feed?.feedName ||
    feed?.name ||
    feed?.itemName ||
    feed?._id?.toString() ||
    "Feed item"
  );
};

const getChangedFields = (before, after) => {
  if (!before || !after) return [];

  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);

  return [...fields].filter(
    (field) =>
      JSON.stringify(before[field] ?? null) !==
      JSON.stringify(after[field] ?? null),
  );
};

// ================= CREATE FEED =================

exports.createFeed = async (req, res) => {
  try {
    const feed = await Feed.create(req.body);

    // AUDIT LOG: CREATE FEED
    await logAudit(req, {
      action: "CREATE",
      module: "Feed Inventory",
      description: `Created feed inventory item: ${getFeedName(feed)}`,
      entityId: feed._id,
      entityName: getFeedName(feed),
      after: getFeedAuditSnapshot(feed),
      metadata: {
        operation: "CREATE_FEED",
      },
    });

    // Socket event
    const io = req.app.get("io");

    if (io) {
      io.emit("feedCreated", feed);
    }

    res.status(201).json(feed);
  } catch (err) {
    console.error("CREATE FEED ERROR:", err);

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
      // Super Admin sees everything.
      feeds = await Feed.find().sort({ createdAt: -1 });
    } else {
      // Others don't see deleted feeds.
      feeds = await Feed.find({
        isDeleted: false,
      }).sort({ createdAt: -1 });
    }

    res.json(feeds);
  } catch (err) {
    console.error("GET FEEDS ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= UPDATE FEED =================

exports.updateFeed = async (req, res) => {
  try {
    // Get the original record for audit comparison.
    const existingFeed = await Feed.findById(req.params.id);

    if (!existingFeed) {
      return res.status(404).json({
        error: "Feed not found",
      });
    }

    const before = getFeedAuditSnapshot(existingFeed);

    const feed = await Feed.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!feed) {
      return res.status(404).json({
        error: "Feed not found",
      });
    }

    const after = getFeedAuditSnapshot(feed);
    const changedFields = getChangedFields(before, after);

    // Only log when something actually changed.
    if (changedFields.length > 0) {
      // AUDIT LOG: STOCK UPDATE / ADJUSTMENT
      await logAudit(req, {
        action: "UPDATE",
        module: "Feed Inventory",
        description: `Updated feed inventory item: ${getFeedName(feed)}`,
        entityId: feed._id,
        entityName: getFeedName(feed),
        before,
        after,
        metadata: {
          operation: "UPDATE_FEED",
          changedFields,
        },
      });
    }

    const io = req.app.get("io");

    if (io) {
      io.emit("feedUpdated", feed);
    }

    res.json(feed);
  } catch (err) {
    console.error("UPDATE FEED ERROR:", err);

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

    // Capture the original state before deletion.
    const before = getFeedAuditSnapshot(feed);

    feed.isDeleted = true;
    feed.deletedAt = new Date();

    if (req.user) {
      const requesterId = req.user.id || req.user._id;
      const admin = requesterId ? await Admin.findById(requesterId) : null;

      if (admin) {
        feed.deletedBy = admin.name;
        feed.deletedByRole = admin.role;
      } else {
        feed.deletedBy = "Unknown";
        feed.deletedByRole = "";
      }
    }

    await feed.save();

    // AUDIT LOG: SOFT DELETE FEED
    await logAudit(req, {
      action: "DELETE",
      module: "Feed Inventory",
      description: `Deleted feed inventory item: ${getFeedName(feed)}`,
      entityId: feed._id,
      entityName: getFeedName(feed),
      before,
      after: getFeedAuditSnapshot(feed),
      metadata: {
        operation: "SOFT_DELETE",
        deletionType: "soft",
      },
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("feedDeleted", feed);
    }

    res.json({
      message: "Feed deleted successfully",
    });
  } catch (err) {
    console.error("DELETE FEED ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};
