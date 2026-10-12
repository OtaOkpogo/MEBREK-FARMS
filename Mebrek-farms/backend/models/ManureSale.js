const mongoose = require("mongoose");

const MANURE_CATEGORY_PRICES = {
  dry: 1000,
  wet: 500,
};

const manureSaleLineItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["dry", "wet"],
      required: true,
    },
    bags: {
      type: Number,
      required: true,
      min: [0, "Bags cannot be negative"],
    },
    pricePerBag: {
      type: Number,
      required: true,
      min: [0, "Price per bag cannot be negative"],
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
  },
  { _id: false },
);

const paymentBreakdownSchema = new mongoose.Schema(
  {
    cash: {
      type: Number,
      default: 0,
      min: [0, "Cash payment cannot be negative"],
    },
    transfer: {
      type: Number,
      default: 0,
      min: [0, "Transfer payment cannot be negative"],
    },
    pos: {
      type: Number,
      default: 0,
      min: [0, "POS payment cannot be negative"],
    },
  },
  { _id: false },
);

const manureSaleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
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

    lineItems: {
      type: [manureSaleLineItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "A sale must have at least one line item.",
      },
    },

    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },

    transportCharge: {
      type: Number,
      default: 0,
      min: [0, "Transport charge cannot be negative"],
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: [0, "Total amount cannot be negative"],
    },

    // Total received across all payment methods.
    // Kept for compatibility with existing reports and UI.
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },

    // Breakdown of the total received.
    payments: {
      type: paymentBreakdownSchema,
      default: () => ({
        cash: 0,
        transfer: 0,
        pos: 0,
      }),
    },

    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS", "Mixed"],
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

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

manureSaleSchema.index({
  customer: "text",
  phone: "text",
  remarks: "text",
});

manureSaleSchema.index({
  isDeleted: 1,
  createdAt: -1,
});

module.exports = mongoose.model("ManureSale", manureSaleSchema);
module.exports.MANURE_CATEGORY_PRICES = MANURE_CATEGORY_PRICES;
