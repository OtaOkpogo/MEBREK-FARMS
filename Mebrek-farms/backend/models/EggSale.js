const mongoose = require("mongoose");

// =====================================================
// OFFICIAL EGG CATEGORY PRICES
// =====================================================
// These are the official farm prices per crate.
// The frontend must NOT be trusted to determine prices.
// The controller always uses these server-side prices.

const EGG_CATEGORY_PRICES = {
  big: 5000,
  jumbo: 5800,
  turkey: 6000,
  normal: 4900,
  small: 4000,
};

// =====================================================
// EGG LINE ITEM SCHEMA
// =====================================================

const eggLineItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["big", "jumbo", "turkey", "normal", "small"],
      required: true,
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

    // Official price stored with the sale for historical accuracy.
    cratePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    // Price of one loose egg.
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
// MAIN EGG SALE SCHEMA
// =====================================================

const eggSaleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
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

    // IMPORTANT:
    // This is the date the sale belongs to.
    // Daily/weekly/monthly sales must use this field,
    // NOT createdAt.
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // =================================================
    // NEW MULTI-CATEGORY SALE STRUCTURE
    // =================================================

    lineItems: {
      type: [eggLineItemSchema],
      default: [],
    },

    // =================================================
    // LEGACY FIELDS
    // =================================================
    // These are retained temporarily so older sales
    // already stored in MongoDB don't immediately break.
    //
    // New sales should use lineItems.

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

    // =================================================
    // SALE TOTALS
    // =================================================

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

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
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
      trim: true,
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // =================================================
    // SOFT DELETE
    // =================================================

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
  isDeleted: 1,
  date: -1,
});

eggSaleSchema.index({
  isDeleted: 1,
  createdAt: -1,
});

// =====================================================
// EXPORTS
// =====================================================

const EggSale = mongoose.model("EggSale", eggSaleSchema);

module.exports = EggSale;

// Export prices separately so the controller can safely use them.
module.exports.EGG_CATEGORY_PRICES = EGG_CATEGORY_PRICES;
module.exports.EGG_CATEGORY_PRICES = EGG_CATEGORY_PRICES;
