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

    // General expense or an individual salary payment
    expenseType: {
      type: String,
      enum: ["General", "Salary"],
      default: "General",
      index: true,
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
        "Salaries",
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

    // For salary expenses, this is the actual amount paid,
    // not the full monthly salary unless paid in full.
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
    // SALARY PAYMENT DETAILS
    // =========================

    // Worker receiving this particular payment.
    // Remains null for ordinary expenses.
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      default: null,
      index: true,
    },

    // Snapshot of the worker's name when payment is recorded.
    workerName: {
      type: String,
      trim: true,
      default: "",
    },

    // Snapshot of the worker's employee/staff ID.
    employeeId: {
      type: String,
      trim: true,
      default: "",
    },

    // Salary month in YYYY-MM format, e.g. 2026-10.
    // This is separate from the actual payment date.
    salaryPeriod: {
      type: String,
      trim: true,
      match: [
        /^$|^\d{4}-(0[1-9]|1[0-2])$/,
        "Salary period must use YYYY-MM format",
      ],
      default: "",
      index: true,
    },

    // Monthly salary copied from the Worker record when
    // the payment is recorded. Used to calculate balances.
    salaryAmount: {
      type: Number,
      min: [0, "Monthly salary cannot be negative"],
      default: null,
    },

    // Groups payments recorded together through bulk payroll.
    // Each worker still receives an individual expense record.
    payrollBatchId: {
      type: String,
      trim: true,
      default: "",
      index: true,
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

// Supports salary balance calculations by worker and month.
expenseSchema.index({
  worker: 1,
  salaryPeriod: 1,
  expenseType: 1,
  isDeleted: 1,
});

module.exports = mongoose.model("Expense", expenseSchema);
