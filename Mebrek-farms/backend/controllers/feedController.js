const mongoose = require("mongoose");

const Feed = require("../models/Feed");
const FeedTransaction = require("../models/FeedTransaction");
const Admin = require("../models/Admin");
const { logAudit } = require("../utils/auditLogger");

// =====================================================
// AUDIT HELPERS
// =====================================================

const getFeedAuditSnapshot = (feed) => {
  if (!feed) return null;

  const snapshot =
    typeof feed.toObject === "function" ? feed.toObject() : { ...feed };

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

const getRequesterId = (req) => {
  return req.user?.id || req.user?._id || null;
};

const emitFeedEvent = (req, event, feed) => {
  const io = req.app.get("io");

  if (io) {
    io.emit(event, feed);
  }
};

// =====================================================
// CREATE FEED
// Initial stock may be entered when creating an item.
// Subsequent stock changes must use adjustFeedStock.
// =====================================================

exports.createFeed = async (req, res) => {
  try {
    const {
      name,
      quantity,
      unit,
      pricePerUnit,
      supplier,
      lowStockThreshold,
      purchaseDate,
      expiryDate,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: "Feed name is required.",
      });
    }

    const initialQuantity = Number(quantity);

    if (
      quantity === undefined ||
      !Number.isFinite(initialQuantity) ||
      initialQuantity < 0
    ) {
      return res.status(400).json({
        error: "A valid non-negative opening quantity is required.",
      });
    }

    const price = Number(pricePerUnit);

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        error: "A valid non-negative price per unit is required.",
      });
    }

    const feed = await Feed.create({
      name: String(name).trim(),
      quantity: initialQuantity,
      unit: unit || "bags",
      pricePerUnit: price,
      supplier,
      lowStockThreshold:
        lowStockThreshold === undefined ? 5 : Number(lowStockThreshold),
      purchaseDate,
      expiryDate,
    });

    await logAudit(req, {
      action: "CREATE",
      module: "Feed Inventory",
      description: `Created feed inventory item: ${getFeedName(feed)}`,
      entityId: feed._id,
      entityName: getFeedName(feed),
      after: getFeedAuditSnapshot(feed),
      metadata: {
        operation: "CREATE_FEED",
        openingStock: initialQuantity,
      },
    });

    emitFeedEvent(req, "feedCreated", feed);

    return res.status(201).json(feed);
  } catch (err) {
    console.error("CREATE FEED ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

// =====================================================
// GET FEEDS
// =====================================================

exports.getFeeds = async (req, res) => {
  try {
    let feeds;

    if (req.user?.role === "superadmin") {
      feeds = await Feed.find().sort({ createdAt: -1 });
    } else {
      feeds = await Feed.find({
        isDeleted: false,
      }).sort({ createdAt: -1 });
    }

    return res.json(feeds);
  } catch (err) {
    console.error("GET FEEDS ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

// =====================================================
// UPDATE FEED DETAILS
//
// IMPORTANT:
// quantity is deliberately excluded.
// Use adjustFeedStock for stock movements.
// =====================================================

exports.updateFeed = async (req, res) => {
  try {
    const existingFeed = await Feed.findById(req.params.id);

    if (!existingFeed) {
      return res.status(404).json({
        error: "Feed not found.",
      });
    }

    if (existingFeed.isDeleted) {
      return res.status(400).json({
        error: "This feed item has been deleted and cannot be edited.",
      });
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "quantity")) {
      return res.status(400).json({
        error:
          "Stock quantity cannot be changed through feed editing. Use the stock adjustment operation instead.",
      });
    }

    const allowedFields = [
      "name",
      "unit",
      "pricePerUnit",
      "supplier",
      "lowStockThreshold",
      "purchaseDate",
      "expiryDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No permitted feed details were supplied for updating.",
      });
    }

    const before = getFeedAuditSnapshot(existingFeed);

    const feed = await Feed.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!feed) {
      return res.status(404).json({
        error: "Feed not found.",
      });
    }

    const after = getFeedAuditSnapshot(feed);
    const changedFields = getChangedFields(before, after);

    if (changedFields.length > 0) {
      await logAudit(req, {
        action: "UPDATE",
        module: "Feed Inventory",
        description: `Updated feed details: ${getFeedName(feed)}`,
        entityId: feed._id,
        entityName: getFeedName(feed),
        before,
        after,
        metadata: {
          operation: "UPDATE_FEED_DETAILS",
          changedFields,
        },
      });
    }

    emitFeedEvent(req, "feedUpdated", feed);

    return res.json(feed);
  } catch (err) {
    console.error("UPDATE FEED ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};

// =====================================================
// ADJUST FEED STOCK
//
// direction: "add" or "remove"
// quantity: positive number
//
// This operation is for stock receipts and authorised
// corrections. Production consumption is handled by
// the Production feed service.
// =====================================================

exports.adjustFeedStock = async (req, res) => {
  const session = await mongoose.startSession();

  let updatedFeed = null;
  let transactionRecord = null;
  let before = null;

  try {
    const { direction, quantity, remarks } = req.body;

    const amount = Number(quantity);

    if (!["add", "remove"].includes(direction)) {
      return res.status(400).json({
        error: 'Direction must be either "add" or "remove".',
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: "Adjustment quantity must be greater than zero.",
      });
    }

    if (direction === "remove" && !String(remarks || "").trim()) {
      return res.status(400).json({
        error: "Please provide a reason for removing stock.",
      });
    }

    await session.startTransaction();

    const existingFeed = await Feed.findById(req.params.id).session(session);

    if (!existingFeed) {
      throw new Error("Feed not found.");
    }

    if (existingFeed.isDeleted) {
      throw new Error("Deleted feed items cannot have stock adjusted.");
    }

    before = getFeedAuditSnapshot(existingFeed);

    const stockBefore = Number(existingFeed.quantity);
    const stockAfter =
      direction === "add" ? stockBefore + amount : stockBefore - amount;

    if (stockAfter < 0) {
      throw new Error(
        `Insufficient stock. Available: ${stockBefore} ${existingFeed.unit || "bags"}.`,
      );
    }

    const stockFilter = {
      _id: existingFeed._id,
      isDeleted: false,
    };

    if (direction === "remove") {
      stockFilter.quantity = { $gte: amount };
    }

    updatedFeed = await Feed.findOneAndUpdate(
      stockFilter,
      {
        $inc: {
          quantity: direction === "add" ? amount : -amount,
        },
      },
      {
        new: true,
        session,
        runValidators: true,
      },
    );

    if (!updatedFeed) {
      throw new Error(
        "Stock adjustment could not be completed. The available stock may have changed. Refresh and try again.",
      );
    }

    const requesterId = getRequesterId(req);

    transactionRecord = await FeedTransaction.create(
      [
        {
          feed: updatedFeed._id,
          transactionType: "ADJUSTMENT",
          quantity: amount,
          stockBefore,
          stockAfter,
          unit: updatedFeed.unit || "bags",
          transactionDate: new Date(),
          createdBy: requesterId,
          remarks: String(remarks || "").trim(),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    const after = getFeedAuditSnapshot(updatedFeed);

    await logAudit(req, {
      action: "UPDATE",
      module: "Feed Inventory",
      description:
        `${direction === "add" ? "Added" : "Removed"} ${amount} ` +
        `${updatedFeed.unit || "bags"} of ${getFeedName(updatedFeed)}.`,
      entityId: updatedFeed._id,
      entityName: getFeedName(updatedFeed),
      before,
      after,
      metadata: {
        operation: "ADJUST_FEED_STOCK",
        direction,
        quantity: amount,
        stockBefore,
        stockAfter,
        transactionId: transactionRecord[0]._id,
        remarks: String(remarks || "").trim(),
      },
    });

    emitFeedEvent(req, "feedUpdated", updatedFeed);

    return res.json({
      message: "Feed stock adjusted successfully.",
      feed: updatedFeed,
      stockBefore,
      stockAfter,
      transaction: transactionRecord[0],
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("ADJUST FEED STOCK ERROR:", err);

    const statusCode =
      err.message === "Feed not found."
        ? 404
        : err.message.includes("Insufficient stock")
          ? 400
          : err.message.includes("Deleted feed")
            ? 400
            : 500;

    return res.status(statusCode).json({
      error: err.message,
    });
  } finally {
    await session.endSession();
  }
};

// =====================================================
// DELETE FEED (SOFT DELETE)
// =====================================================

exports.deleteFeed = async (req, res) => {
  try {
    const feed = await Feed.findById(req.params.id);

    if (!feed) {
      return res.status(404).json({
        error: "Feed not found.",
      });
    }

    if (feed.isDeleted) {
      return res.status(400).json({
        error: "This feed item has already been deleted.",
      });
    }

    const before = getFeedAuditSnapshot(feed);

    feed.isDeleted = true;
    feed.deletedAt = new Date();

    if (req.user) {
      const requesterId = getRequesterId(req);
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

    emitFeedEvent(req, "feedDeleted", feed);

    return res.json({
      message: "Feed deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE FEED ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};
