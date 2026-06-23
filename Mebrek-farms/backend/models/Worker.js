const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    gender: {
      type: String,
      enum: ["Male", "Female"],
    },

    phone: String,

    email: String,

    address: String,

    role: {
      type: String,
      required: true,
    },

    department: {
      type: String,
      default: "Production",
    },

    employmentType: {
      type: String,
      enum: ["Permanent", "Contract", "Casual"],
      default: "Permanent",
    },

    dateHired: {
      type: Date,
      default: Date.now,
    },

    salary: {
      type: Number,
      default: 0,
    },

    bankName: String,

    accountNumber: String,

    nextOfKin: String,

    nextOfKinPhone: String,

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    notes: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Worker", workerSchema);
