
const mongoose = require("mongoose");

const Feed = require("../models/Feed");
const FeedTransaction = require("../models/FeedTransaction");

const getUserId = (req) =>
  req?.user?.id || req?.user?._id || null;

const getFeedId = (feedUsed) => {
  if (!feedUsed) return null;

  const value = feedUsed.feed?._id || feedUsed.feed;

  return value ? String(value) : null;
};

const getFeedQuantity = (value) => {
  const quantity = Number(value || 0);

  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Feed consumption must be a non-negative number.");
  }

  return quantity;
};

const validateSession = (session) => {
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Feed inventory changes must run inside a MongoDB transaction.",
    );
  }
};

const restoreFeedStock = async ({
  feedId,
  quantity,
  production,
  req,
  session,
  remarks,
}) => {
  if (!quantity) return null;

  const feed = await Feed.findById(feedId).session(session);

  if (!feed) {
    throw new Error(
      "The feed inventory item linked to this Production record no longer exists.",
    );
  }

  const stockBefore = Number(feed.quantity);
  const stockAfter = stockBefore + quantity;

  await Feed.updateOne(
    { _id: feed._id },
    { $inc: { quantity } },
    { session },
  );

  const transaction = await FeedTransaction.create(
    [
      {
        feed: feed._id,
        production: production._id,
        pen: production.pen,
        transactionType: "PRODUCTION_REVERSAL",
        quantity,
        stockBefore,
        stockAfter,
        unit: feed.unit || "bags",
        transactionDate: new Date(),
        remarks,
        createdBy: getUserId(req),
      },
    ],
    { session },
  );

  return transaction[0];
};

const deductFeedStock = async ({
  feedId,
  quantity,
  production,
  req,
  session,
}) => {
  if (!quantity) return null;

  if (!mongoose.Types.ObjectId.isValid(feedId)) {
    throw new Error("Select a valid feed inventory item.");
  }

  // Atomic stock check and deduction. This prevents two concurrent
  // Production requests from consuming the same available stock.
  const feed = await Feed.findOneAndUpdate(
    {
      _id: feedId,
      isDeleted: false,
      quantity: { $gte: quantity },
    },
    {
      $inc: { quantity: -quantity },
    },
    {
      new: false,
      session,
      runValidators: true,
    },
  );

  if (!feed) {
    const existingFeed = await Feed.findById(feedId).session(session);

    if (!existingFeed || existingFeed.isDeleted) {
      throw new Error(
        "The selected feed item does not exist or has been deleted.",
      );
    }

    throw new Error(
      `Insufficient ${existingFeed.name} stock. Available: ${existingFeed.quantity} ${existingFeed.unit || "bags"}; required: ${quantity}.`,
    );
  }

  const stockBefore = Number(feed.quantity);
  const stockAfter = stockBefore - quantity;

  const transaction = await FeedTransaction.create(
    [
      {
        feed: feed._id,
        production: production._id,
        pen: production.pen,
        transactionType: "PRODUCTION_CONSUMPTION",
        quantity,
        stockBefore,
        stockAfter,
        unit: feed.unit || "bags",
        transactionDate: production.date,
        remarks: `Feed consumed in ${production.pen}`,
        createdBy: getUserId(req),
      },
    ],
    { session },
  );

  production.feedUsed = {
    feed: feed._id,
    feedName: feed.name,
  };

  return transaction[0];
};

/**
 * Synchronises a Production record's feed consumption.
 *
 * Must be called inside the existing Production transaction.
 *
 * Legacy Production records without feed references are left untouched
 * unless someone attempts to change their existing feed consumption.
 */
const syncProductionFeed = async ({
  production,
  previousFeedUsed = null,
  previousFeedBagsConsumed = 0,
  hasFeedInput = false,
  req,
  session,
}) => {
  validateSession(session);

  const previousQuantity = getFeedQuantity(
    previousFeedBagsConsumed,
  );

  const currentQuantity = getFeedQuantity(
    production.feedBagsConsumed,
  );

  const previousFeedId = getFeedId(previousFeedUsed);
  const currentFeedId = getFeedId(production.feedUsed);

  // Legacy record: quantity exists, but the original feed type is unknown.
  // Never guess which inventory item should be restored.
  if (previousQuantity > 0 && !previousFeedId) {
    if (
      hasFeedInput &&
      (
        currentQuantity !== previousQuantity ||
        currentFeedId
      )
    ) {
      throw new Error(
        "This older Production record has feed consumption but no feed inventory reference. Reconcile its historical feed usage before changing its feed consumption.",
      );
    }

    return {
      changed: false,
      legacyConsumption: true,
    };
  }

  const sameFeed =
    previousFeedId === currentFeedId;

  const sameQuantity =
    previousQuantity === currentQuantity;

  if (sameFeed && sameQuantity) {
    return {
      changed: false,
      legacyConsumption: false,
    };
  }

  // Restore the previous consumption first.
  if (previousQuantity > 0 && previousFeedId) {
    await restoreFeedStock({
      feedId: previousFeedId,
      quantity: previousQuantity,
      production,
      req,
      session,
      remarks: "Previous Production feed consumption reversed.",
    });
  }

  // A positive consumption must identify its feed item.
  if (currentQuantity > 0 && !currentFeedId) {
    throw new Error(
      "Select a feed type before entering the number of feed bags consumed.",
    );
  }

  if (currentQuantity > 0) {
    await deductFeedStock({
      feedId: currentFeedId,
      quantity: currentQuantity,
      production,
      req,
      session,
    });
  } else {
    production.feedUsed = {
      feed: null,
      feedName: "",
    };
  }

  return {
    changed: true,
    legacyConsumption: false,
  };
};

/**
 * Restores feed consumed by a Production record being deleted.
 * Must run inside the same transaction as Production deletion.
 */
const reverseProductionFeed = async ({
  production,
  req,
  session,
}) => {
  validateSession(session);

  const quantity = getFeedQuantity(
    production.feedBagsConsumed,
  );

  const feedId = getFeedId(production.feedUsed);

  if (!quantity || !feedId) {
    return {
      changed: false,
    };
  }

  await restoreFeedStock({
    feedId,
    quantity,
    production,
    req,
    session,
    remarks: "Feed restored because its Production record was deleted.",
  });

  return {
    changed: true,
  };
};

module.exports = {
  syncProductionFeed,
  reverseProductionFeed,
};

