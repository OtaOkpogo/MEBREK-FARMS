const mongoose = require("mongoose");

const saleAccessRequestSchema = new mongoose.Schema(
  {
    saleType: {
      type: String,
      enum: ["egg", "manure"],
      required: true,
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    requesterName: {
      type: String,
      trim: true,
      default: "",
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },
    accessExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    requesterViewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

saleAccessRequestSchema.index({
  saleType: 1,
  saleId: 1,
  requesterId: 1,
  status: 1,
});

module.exports = mongoose.model("SaleAccessRequest", saleAccessRequestSchema);
