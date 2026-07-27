const mongoose = require("mongoose");

// Fixed reference prices per crate, by category — used by the frontend to
// auto-fill unitPrice, and by the backend to validate against tampering.
const EGG_CATEGORY_PRICES = {
  big: 5000,
  jumbo: 5800,
  turkey: 6000,
  normal: 4900,
  small: 4000,
};

const eggSaleLineItemSchema = new mongoose.Schema(
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
    cratePrice: {
      type: Number,
      required: true, // snapshot of EGG_CATEGORY_PRICES[category] at time of sale
    },
    eggPrice: {
      type: Number,
      default: 0, // price per loose egg for this category (cratePrice / 30, or set explicitly)
    },
    subtotal: {
      type: Number,
      required: true, // cratesSold * cratePrice + looseEggs * eggPrice
    },
  },
  { _id: false },
);

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

    // ---- Replaces the old single cratesSold/looseEggs/cratePrice/eggPrice ----
    lineItems: {
      type: [eggSaleLineItemSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A sale must have at least one line item.",
      },
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
      default: 0, // sum(lineItems.subtotal) + transportCharge - discount
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
    // ---- Soft delete, matching the Medications/BirdHealth/Vaccinations pattern ----
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
  {
    timestamps: true,
  },
);

eggSaleSchema.index({
  customer: "text",
  phone: "text",
  remarks: "text",
});
eggSaleSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("EggSale", eggSaleSchema);
module.exports.EGG_CATEGORY_PRICES = EGG_CATEGORY_PRICES;
