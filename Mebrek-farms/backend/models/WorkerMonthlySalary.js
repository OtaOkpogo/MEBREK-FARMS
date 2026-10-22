const mongoose = require("mongoose");

const workerMonthlySalarySchema = new mongoose.Schema(
  {
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true,
    },

    salaryPeriod: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },

    salaryAmount: {
      type: Number,
      required: true,
      min: [0.01, "Agreed monthly salary must be greater than zero."],
    },

    workerName: {
      type: String,
      default: "",
      trim: true,
    },

    employeeId: {
      type: String,
      default: "",
      trim: true,
    },

    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    setByName: {
      type: String,
      default: "",
      trim: true,
    },

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
  },
  {
    timestamps: true,
  },
);

workerMonthlySalarySchema.index(
  { worker: 1, salaryPeriod: 1 },
  { unique: true },
);

module.exports = mongoose.model(
  "WorkerMonthlySalary",
  workerMonthlySalarySchema,
);

