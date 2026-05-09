const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema(
  {
    eggsCollected: {
      type: Number,
      required: true,
    },

    mortality: {
      type: Number,
      default: 0,
    },

    feedUsed: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Production",
  productionSchema
);
