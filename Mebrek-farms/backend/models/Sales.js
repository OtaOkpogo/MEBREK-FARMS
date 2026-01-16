const mongoose = require("mongoose");

const salesSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now
    },
    traysSold: {
      type: Number,
      required: true
    },
    pricePerTray: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    customerName: {
      type: String
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sales", salesSchema);

