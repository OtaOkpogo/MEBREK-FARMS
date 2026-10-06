const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    // =========================
    // EXPENSE IDENTIFICATION
    // =========================
    expenseNumber: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },

    // =========================
    // EXPENSE DETAILS
    // =========================
    date: {
      type: Date,
      required: [true, "Expense date is required"],
    },

    category: {
      type: String,
      required: [true, "Expense category is required"],
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

    description: {
      type: String,
      required: [true, "Expense description is required"],
      trim: true,
      minlength: [2, "Description must contain at least 2 characters"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
      default: 1,
    },

    unitCost: {
      type: Number,
      required: true,
      min: [0, "Unit cost cannot be negative"],
      default: 0,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },

    supplier: {
      type: String,
      trim: true,
      maxlength: [200, "Supplier name cannot exceed 200 characters"],
      default: "",
    },

    paymentMethod: {
      type: String,
      enum: ["Cash", "Transfer", "POS"],
      default: "Cash",
    },

    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, "Remarks cannot exceed 1000 characters"],
      default: "",
    },

    // =========================
    // AUDIT — CREATED
    // =========================
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

    // =========================
    // AUDIT — UPDATED
    // =========================
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    updatedByName: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // SOFT DELETE
    // =========================
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

    deletedByName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// =========================
// INDEXES
// =========================

expenseSchema.index({
  date: -1,
  isDeleted: 1,
});

expenseSchema.index({
  category: 1,
  isDeleted: 1,
});

expenseSchema.index({
  supplier: 1,
  isDeleted: 1,
});

module.exports = mongoose.model("Expense", expenseSchema);
