
const mongoose = require("mongoose");
const PENS = require("../constants/pens");

const flockPopulationHistorySchema = new mongoose.Schema(
  {
    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
      required: true,
      index: true,
    },

    allocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlockAllocation",
      default: null,
    },

    pen: {
      type: String,
      enum: PENS,
      default: null,
    },

    eventType: {
      type: String,
      required: true,
      enum: [
        "INITIAL_PLACEMENT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "MORTALITY",
        "SALE",
        "ADJUSTMENT",
      ],
      index: true,
    },

    // Positive = birds added.
    // Negative = birds removed.
    // null = population change cannot be quantified.
    quantityChange: {
      type: Number,
      default: null,
      validate: {
        validator: (value) =>
          value === null || Number.isInteger(value),
        message: "Population change must be a whole number.",
      },
    },

    // null means the resulting population is unknown.
    balanceAfter: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: (value) =>
          value === null ||
          (Number.isInteger(value) && value >= 0),
        message: "Population balance must be a non-negative whole number.",
      },
    },

    eventDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    sourceType: {
      type: String,
      enum: [
        "FLOCK",
        "TRANSFER",
        "MORTALITY",
        "PRODUCTION",
        "SALE",
        "ADJUSTMENT",
        null,
      ],
      default: null,
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  },
);

flockPopulationHistorySchema.index({
  flock: 1,
  eventDate: -1,
});

flockPopulationHistorySchema.index({
  allocation: 1,
  eventDate: -1,
});

flockPopulationHistorySchema.index({
  sourceType: 1,
  sourceId: 1,
});

module.exports = mongoose.model(
  "FlockPopulationHistory",
  flockPopulationHistorySchema,
);

