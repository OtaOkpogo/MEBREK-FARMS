const mongoose = require("mongoose");

const customerCreditLedgerSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },

    // credit_created: customer paid more than an invoice required.
    // credit_applied: existing credit was used on a new invoice.
    // refund: credit was returned to the customer.
    // adjustment: an authorised manual correction.
    entryType: {
      type: String,
      enum: [
        "credit_created",
        "credit_applied",
        "refund",
        "adjustment",
      ],
      required: true,
      index: true,
    },

    // "credit" increases what the farm owes the customer.
    // "debit" decreases the customer's available credit.
    direction: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    // Available customer credit immediately after this movement.
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EggSale",
      default: null,
      index: true,
    },

    invoiceNumber: {
      type: String,
      default: "",
      trim: true,
    },

    // Used to prevent the same financial event being recorded twice.
    referenceKey: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Required for adjustments and useful for refunds.
    reason: {
      type: String,
      default: "",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    createdByName: {
      type: String,
      default: "",
      trim: true,
    },

    createdByRole: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true },
);

customerCreditLedgerSchema.index({
  customerId: 1,
  createdAt: -1,
});

customerCreditLedgerSchema.index({
  saleId: 1,
  entryType: 1,
});

module.exports = mongoose.model(
  "CustomerCreditLedger",
  customerCreditLedgerSchema,
);
