const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now
    },
    feedType: {
      type: String,
      enum: ["Starter", "Grower", "Layer"],
      required: true
    },
    quantityKg: {
      type: Number,
      required: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feed", feedSchema);

