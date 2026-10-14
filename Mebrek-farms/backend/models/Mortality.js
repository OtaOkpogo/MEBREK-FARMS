const mongoose = require("mongoose");

const mortalitySchema = new mongoose.Schema(
  {
    birdBatch: {
      type: String,
      required: true,
    },

    productionRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Production",
      default: null,
    },

    numberDead: {
      type: Number,
      required: true,
    },

    birdHealthRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BirdHealth",
      default: null,
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

mortalitySchema.index(
  { productionRecord: 1 },
  {
    unique: true,
    partialFilterExpression: {
      productionRecord: { $type: "objectId" },
    },
  },
);
module.exports = mongoose.model("Mortality", mortalitySchema);
