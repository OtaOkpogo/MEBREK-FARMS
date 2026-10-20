const mongoose = require("mongoose");

const recipientSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    name: { type: String, default: "" },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    attemptedAt: { type: Date, default: null },
  },
  { _id: false },
);

const smsCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ["marketing", "transactional"],
      default: "marketing",
    },
    status: {
      type: String,
      enum: ["processing", "completed", "partial", "failed"],
      default: "processing",
    },
    recipients: {
      type: [recipientSchema],
      default: [],
    },
    createdBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
    },
    totalRecipients: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

smsCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SMSCampaign", smsCampaignSchema);
