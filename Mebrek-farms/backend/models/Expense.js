const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },

    category: {
      type: String,
      required: true,
      enum: [
        "Feed",
        "Drugs",
        "Labour",
        "Fuel",
        "Repairs",
        "Utilities",
        "Transport",
        "Other",
      ],
    },

    description: { type: String, required: true },

    quantity: { type: Number, default: 1 },

    unitCost: { type: Number, default: 0 },

    amount: { type: Number, required: true },

    supplier: { type: String, default: "" },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS"],
      default: "Cash",
    },

    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Expense", expenseSchema);
