const mongoose = require("mongoose");

const feedInvoiceSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      trim: true,
    },

    feedName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  },
);

// Global Search Text Index
feedInvoiceSchema.index({
  supplier: "text",
  feedName: "text",
  paymentStatus: "text",
});

module.exports = mongoose.model("FeedInvoice", feedInvoiceSchema);
