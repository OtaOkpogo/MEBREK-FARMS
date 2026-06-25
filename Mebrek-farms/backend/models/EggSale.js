const mongoose = require("mongoose");

const eggSaleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
    },

    customer: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      default: Date.now,
    },

    cratesSold: {
      type: Number,
      default: 0,
    },

    looseEggs: {
      type: Number,
      default: 0,
    },

    cratePrice: {
      type: Number,
      required: true,
    },

    eggPrice: {
      type: Number,
      default: 0,
    },

    discount: {
      type: Number,
      default: 0,
    },

    transportCharge: {
      type: Number,
      default: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS"],
      default: "Cash",
    },

    status: {
      type: String,
      enum: ["Paid", "Part Paid", "Unpaid"],
      default: "Unpaid",
    },

    remarks: {
      type: String,
      default: "",
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EggSale", eggSaleSchema);
