const mongoose = require("mongoose");

const feedInvoiceSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
    },

    feedName: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    unitPrice: {
      type: Number,
      required: true,
    },

    totalCost: {
      type: Number,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "FeedInvoice",
  feedInvoiceSchema
);
