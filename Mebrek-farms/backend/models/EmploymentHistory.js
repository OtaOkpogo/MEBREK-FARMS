
const mongoose = require("mongoose");

const employmentHistorySchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true,
    },

    changeType: {
      type: String,
      required: true,
      enum: [
        "Hired",
        "Role Change",
        "Department Change",
        "Status Change",
        "Employment Type Change",
        "Salary Change",
        "Supervisor Change",
        "Farm Area Change",
        "General Update",
      ],
    },

    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    previousValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    changedById: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    changedByName: {
      type: String,
      trim: true,
      default: "",
    },

    changedByRole: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

employmentHistorySchema.index({
  workerId: 1,
  effectiveDate: -1,
});

module.exports = mongoose.model(
  "EmploymentHistory",
  employmentHistorySchema
);

