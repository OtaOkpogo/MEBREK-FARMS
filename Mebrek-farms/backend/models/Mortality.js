const mongoose = require("mongoose");

const mortalitySchema = new mongoose.Schema(
  {
    birdBatch: {
      type: String,
      required: true,
    },

    numberDead: {
      type: Number,
      required: true,
    },

    cause: {
      type: String,
      required: true,
    },

    estimatedLoss: {
      type: Number,
      default: 0,
    },

    notes: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Mortality", mortalitySchema);
