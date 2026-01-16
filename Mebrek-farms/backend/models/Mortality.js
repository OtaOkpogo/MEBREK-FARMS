const mongoose = require("mongoose");

const mortalitySchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now
    },
    numberOfBirds: {
      type: Number,
      required: true
    },
    cause: {
      type: String
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Mortality", mortalitySchema);

