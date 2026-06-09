const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    day: {
      type: Number,
      required: true,
    },

    openingStock: {
      type: Number,
      required: true,
    },

    mortality: {
      type: Number,
      default: 0,
    },

    closingStock: {
      type: Number,
      default: 0,
    },

    sickBirds: {
      type: Number,
      default: 0,
    },

    feedBagsConsumed: {
      type: Number,
      default: 0,
    },

    waterConsumed: {
      type: Number,
      default: 0,
    },

    drugsUsed: {
      type: String,
      default: "",
    },

    cratesProduced: {
      type: Number,
      default: 0,
    },

    extraEggPieces: {
      type: Number,
      default: 0,
    },

    totalEggs: {
      type: Number,
      default: 0,
    },

    productionPercentage: {
      type: Number,
      default: 0,
    },

    miscarriageProduction: {
      type: Number,
      default: 0,
    },

    crackedEggs: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Production", productionSchema);
