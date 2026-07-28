const mongoose = require("mongoose");

// Fixed reference prices per bag, by category — used by the frontend to
// auto-fill unitPrice, and by the backend to validate against tampering.
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
      min: [0, "bags cannot be negative"],
    },
    pricePerBag: {
      type: Number,
      required: true, // snapshot of MANURE_CATEGORY_PRICES[category] at time of sale
    },
    subtotal: {
      type: Number,
      required: true, // bags * pricePerBag
    },
  },
  { _id: false },
);

const manureSaleSchema = new mongoose.Schema(
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

    lineItems: {
      type: [manureSaleLineItemSchema],
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
    // ---- Soft delete, matching the EggSale/Medications/BirdHealth pattern ----
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

manureSaleSchema.index({
  customer: "text",
  phone: "text",
  remarks: "text",
});
manureSaleSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("ManureSale", manureSaleSchema);
module.exports.MANURE_CATEGORY_PRICES = MANURE_CATEGORY_PRICES;
