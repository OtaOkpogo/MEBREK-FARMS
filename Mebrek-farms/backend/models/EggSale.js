const mongoose = require("mongoose");

const EGG_CATEGORY_PRICES = Object.freeze({
  big: 5100,
  jumbo: 5800,
  turkey: 6000,
  normal: 5000,
  small: 4000,
});

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["Cash", "Transfer", "POS"],
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: true },
);

const lineItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: Object.keys(EGG_CATEGORY_PRICES),
      required: true,
      lowercase: true,
      trim: true,
    },
    cratesSold: { type: Number, min: 0, default: 0 },
    // One half crate represents 15 eggs and costs exactly half the crate price.
    halfCratesSold: { type: Number, min: 0, default: 0 },
    looseEggs: { type: Number, min: 0, default: 0 },
    cratePrice: { type: Number, min: 0, default: 0 },
    eggPrice: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0, default: 0 },
  },
  { _id: true },
);

const eggSaleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    customer: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    date: { type: Date, required: true, index: true },

    lineItems: { type: [lineItemSchema], default: [] },

    // Legacy single-category fields retained for existing records and compatibility.
    cratesSold: { type: Number, min: 0, default: 0 },
    halfCratesSold: { type: Number, min: 0, default: 0 },
    looseEggs: { type: Number, min: 0, default: 0 },
    cratePrice: { type: Number, min: 0, default: 0 },
    eggPrice: { type: Number, min: 0, default: 0 },

    discount: { type: Number, min: 0, default: 0 },
    transportCharge: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
    payments: { type: [paymentSchema], default: [] },
    amountPaid: { type: Number, min: 0, default: 0 },
    balance: { type: Number, min: 0, default: 0 },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS", "Mixed", ""],
      default: "",
    },
    status: {
      type: String,
      enum: ["Paid", "Part Paid", "Unpaid"],
      default: "Unpaid",
      index: true,
    },
    remarks: { type: String, default: "", trim: true },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

eggSaleSchema.index({ customerId: 1, date: -1 });
eggSaleSchema.index({ isDeleted: 1, date: -1 });

const EggSale = mongoose.model("EggSale", eggSaleSchema);

module.exports = EggSale;
module.exports.EGG_CATEGORY_PRICES = EGG_CATEGORY_PRICES;
