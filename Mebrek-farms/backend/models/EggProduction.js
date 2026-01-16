const mongoose = require("mongoose");

const eggProductionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true
    },
    totalEggs: {
      type: Number,
      required: true
    },
    crackedEggs: {
      type: Number,
      default: 0
    },
    trays: {
      type: Number,
      required: true
    },
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker"
    },
    remarks: {
      type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("EggProduction", eggProductionSchema);

