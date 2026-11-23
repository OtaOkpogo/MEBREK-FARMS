
const mongoose = require("mongoose");
const PENS = require("../constants/pens");

const flockTransferSchema = new mongoose.Schema(
  {
    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
      required: true,
      index: true,
    },

    fromPen: {
      type: String,
      required: true,
      enum: PENS,
    },

    toPen: {
      type: String,
      required: true,
      enum: PENS,
    },

    fromAllocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlockAllocation",
      default: null,
    },

    toAllocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlockAllocation",
      default: null,
    },

    birdsMoved: {
      type: Number,
      required: true,
      min: [1, "At least one bird must be transferred."],
      validate: {
        validator: Number.isInteger,
        message: "Number of birds transferred must be a whole number.",
      },
    },

    transferDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    reason: {
      type: String,
      trim: true,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
      index: true,
    },

    transferredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

flockTransferSchema.pre("validate", function (next) {
  if (this.fromPen && this.toPen && this.fromPen === this.toPen) {
    return next(
      new Error("Source and destination pens must be different."),
    );
  }

  next();
});

flockTransferSchema.index({
  flock: 1,
  transferDate: -1,
});

flockTransferSchema.index({
  fromPen: 1,
  transferDate: -1,
});

flockTransferSchema.index({
  toPen: 1,
  transferDate: -1,
});

module.exports = mongoose.model(
  "FlockTransfer",
  flockTransferSchema,
);

