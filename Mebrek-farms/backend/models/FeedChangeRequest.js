
const mongoose = require("mongoose");

const feedChangeRequestSchema = new mongoose.Schema(
  {
    feed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
      index: true,
    },

    requestType: {
      type: String,
      required: true,
      enum: ["DETAILS_UPDATE", "STOCK_ADJUSTMENT"],
    },

    // Proposed feed details or stock adjustment information.
    requestedChanges: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    requestRemarks: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewRemarks: {
      type: String,
      default: "",
      trim: true,
    },

    // Populated only when an approved stock adjustment executes.
    feedTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedTransaction",
      default: null,
    },

    // Record the feed state at the time of approval.
    stockBefore: {
      type: Number,
      default: null,
    },

    stockAfter: {
      type: Number,
      default: null,
    },

    executedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

feedChangeRequestSchema.index({
  status: 1,
  createdAt: -1,
});

feedChangeRequestSchema.index({
  requestedBy: 1,
  createdAt: -1,
});

module.exports = mongoose.model(
  "FeedChangeRequest",
  feedChangeRequestSchema,
);

