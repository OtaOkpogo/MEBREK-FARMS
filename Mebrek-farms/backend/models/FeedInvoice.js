const mongoose = require("mongoose");

const feedInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    supplier: {
      type: String,
      required: true,
      trim: true,
    },

    // Keep these for backward compatibility.
    // They will eventually move into FeedInvoiceItem.
    feedName: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      default: "bags",
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },

    purchaseDate: {
      type: Date,
      default: Date.now,
    },

    receivedDate: {
      type: Date,
      default: Date.now,
    },

    paymentStatus: {
      type: String,
      enum: ["Paid", "Pending", "Partially Paid"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "POS", "Cheque", "Credit"],
      default: "Cash",
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    transportCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    vehicleNumber: {
      type: String,
      default: "",
      trim: true,
    },

    driverName: {
      type: String,
      default: "",
      trim: true,
    },

    receivedBy: {
      type: String,
      default: "",
      trim: true,
    },

    warehouseLocation: {
      type: String,
      default: "",
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    // =========================
    // Invoice Status
    // =========================
    invoiceStatus: {
      type: String,
      enum: ["Draft", "Approved", "Cancelled"],
      default: "Draft",
    },

    // =========================
    // Audit Fields
    // =========================
    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: String,
      default: null,
    },

    deletedByRole: {
      type: String,
      default: null,
    },

    updatedBy: {
      type: String,
      default: null,
    },

    updatedByRole: {
      type: String,
      default: null,
    },

    restoredAt: {
      type: Date,
      default: null,
    },

    restoredBy: {
      type: String,
      default: null,
    },

    restoredByRole: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Text Search
feedInvoiceSchema.index({
  invoiceNumber: "text",
  supplier: "text",
  feedName: "text",
  paymentStatus: "text",
  invoiceStatus: "text",
  driverName: "text",
  vehicleNumber: "text",
  warehouseLocation: "text",
  remarks: "text",
});

module.exports = mongoose.model("FeedInvoice", feedInvoiceSchema);
