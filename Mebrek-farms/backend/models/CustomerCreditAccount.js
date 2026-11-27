const mongoose = require("mongoose");

const customerCreditAccountSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      unique: true,
      index: true,
    },

    // Current available customer credit.
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Incremented whenever the account changes.
    // Helps MongoDB detect concurrent financial updates.
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "CustomerCreditAccount",
  customerCreditAccountSchema,
);
