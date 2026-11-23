
const mongoose = require("mongoose");
const PENS = require("../constants/pens");

const flockAllocationSchema = new mongoose.Schema(
  {
    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
      required: true,
      index: true,
    },

    pen: {
      type: String,
      required: true,
      enum: PENS,
      index: true,
    },

    // null means the population has not been established.
    openingBirds: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null ||
          (Number.isInteger(value) && value >= 0),
        message: "Opening birds must be a non-negative whole number.",
      },
    },

    // null means unknown, not zero.
    currentBirds: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null ||
          (Number.isInteger(value) && value >= 0),
        message: "Current birds must be a non-negative whole number.",
      },
    },

    allocationDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "CLOSED"],
      default: "ACTIVE",
      index: true,
    },

    closedAt: {
      type: Date,
      default: null,
    },

    closedReason: {
      type: String,
      enum: [
        "TRANSFERRED",
        "SOLD",
        "DEPOPULATED",
        "ADMINISTRATIVE",
        null,
      ],
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// A flock can have only one active allocation in the same pen.
// It can have active allocations in several different pens.
// Several flocks can have active allocations in the same pen.
flockAllocationSchema.index(
  { flock: 1, pen: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "ACTIVE",
    },
  },
);

flockAllocationSchema.index({
  pen: 1,
  status: 1,
});

flockAllocationSchema.index({
  flock: 1,
  status: 1,
});

module.exports = mongoose.model(
  "FlockAllocation",
  flockAllocationSchema,
);

