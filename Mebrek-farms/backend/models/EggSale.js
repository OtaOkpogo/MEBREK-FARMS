const mongoose = require("mongoose");

// =====================================================
// OFFICIAL EGG CATEGORY PRICES
// =====================================================

const EGG_CATEGORY_PRICES = {
  big: 5100,
  jumbo: 5800,
  turkey: 6000,
  normal: 5000,
  small: 4000,
};

const VALID_PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

// =====================================================
// PAYMENT SEGMENT SCHEMA
// =====================================================

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: VALID_PAYMENT_METHODS,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
  },
);

// =====================================================
// EGG LINE ITEM SCHEMA
// =====================================================

const eggLineItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["big", "jumbo", "turkey", "normal", "small"],
      required: true,
      lowercase: true,
      trim: true,
    },

    cratesSold: {
      type: Number,
      default: 0,
      min: 0,
    },

    looseEggs: {
      type: Number,
      default: 0,
      min: 0,
    },

    cratePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    eggPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: true,
  },
);

// =====================================================
// EGG SALE SCHEMA
// =====================================================

const eggSaleSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // INVOICE
    // ---------------------------------------------------

    invoiceNumber: {
      type: String,
      unique: true,
      index: true,
    },

    // ---------------------------------------------------
    // CUSTOMER
    // ---------------------------------------------------

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },

    customer: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // SALE DATE
    // ---------------------------------------------------

    date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // ---------------------------------------------------
    // EGG ITEMS
    // ---------------------------------------------------

    lineItems: {
      type: [eggLineItemSchema],
      default: [],
    },

    // ---------------------------------------------------
    // LEGACY EGG FIELDS
    // ---------------------------------------------------
    // Kept for compatibility with older records.

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
      default: 0,
    },

    eggPrice: {
      type: Number,
      default: 0,
    },

    // ---------------------------------------------------
    // SALE TOTALS
    // ---------------------------------------------------

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    transportCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ---------------------------------------------------
    // SEGMENTED PAYMENTS
    // ---------------------------------------------------
    //
    // Example:
    //
    // payments: [
    //   {
    //     method: "Cash",
    //     amount: 16000
    //   },
    //   {
    //     method: "Transfer",
    //     amount: 1400
    //   }
    // ]
    //
    // Multiple rows are intentionally preserved.

    payments: {
      type: [paymentSchema],
      default: [],
    },

    // ---------------------------------------------------
    // TOTAL AMOUNT PAID
    // ---------------------------------------------------
    //
    // Kept for compatibility with existing records/UI.
    //
    // IMPORTANT:
    // This is the sum of all payment segments.

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ---------------------------------------------------
    // BALANCE
    // ---------------------------------------------------

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ---------------------------------------------------
    // PAYMENT METHOD
    // ---------------------------------------------------
    //
    // Single payment:
    // Cash / Transfer / POS
    //
    // Multiple payment methods:
    // Mixed

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS", "Mixed"],
      default: "Cash",
    },

    // ---------------------------------------------------
    // PAYMENT STATUS
    // ---------------------------------------------------

    status: {
      type: String,
      enum: ["Paid", "Part Paid", "Unpaid"],
      default: "Unpaid",
    },

    // ---------------------------------------------------
    // REMARKS
    // ---------------------------------------------------

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    // ---------------------------------------------------
    // AUDIT
    // ---------------------------------------------------

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // ---------------------------------------------------
    // SOFT DELETE
    // ---------------------------------------------------

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
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
  {
    timestamps: true,
  },
);

// =====================================================
// INDEXES
// =====================================================

eggSaleSchema.index({
  customer: "text",
  phone: "text",
  remarks: "text",
});

eggSaleSchema.index({
  customerId: 1,
  isDeleted: 1,
  date: -1,
});

eggSaleSchema.index({
  isDeleted: 1,
  date: -1,
});

eggSaleSchema.index({
  isDeleted: 1,
  createdAt: -1,
});

// =====================================================
// MODEL
// =====================================================

const EggSale = mongoose.model("EggSale", eggSaleSchema);

module.exports = EggSale;
module.exports.EGG_CATEGORY_PRICES = EGG_CATEGORY_PRICES;
