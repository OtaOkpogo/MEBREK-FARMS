
const mongoose = require("mongoose");

const feedTransactionSchema = new mongoose.Schema(
  {
    feed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
      index: true,
    },

    production: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Production",
      default: null,
      index: true,
    },

    pen: {
      type: String,
      default: null,
    },

    transactionType: {
      type: String,
      required: true,
      enum: [
        "PURCHASE",
        "PRODUCTION_CONSUMPTION",
        "PRODUCTION_REVERSAL",
        "ADJUSTMENT",
      ],
    },

    // Always a positive quantity. transactionType determines its meaning.
    quantity: {
      type: Number,
      required: true,
      min: [0, "Transaction quantity cannot be negative"],
    },

    stockBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    stockAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      default: "bags",
    },

    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

feedTransactionSchema.index({
  feed: 1,
  transactionDate: -1,
});

feedTransactionSchema.index({
  production: 1,
  transactionDate: -1,
});

module.exports = mongoose.model("FeedTransaction", feedTransactionSchema);

