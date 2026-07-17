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
