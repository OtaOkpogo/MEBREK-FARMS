const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    // Registered worker link; optional for legacy records.
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      default: null,
    },

    workerName: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      trim: true,
    },

    // YYYY-MM-DD, independent of record creation time.
    attendanceDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
      default: undefined,
    },

    status: {
      type: String,
      enum: [
        "Present",
        "Absent",
        "Late",
        "Leave",
        "Sick Leave",
        "Holiday",
        "Off Day",
      ],
      default: "Present",
    },

    checkInTime: {
      type: String,
      default: "",
      trim: true,
    },

    checkOutTime: {
      type: String,
      default: "",
      trim: true,
    },

    scheduledStartTime: {
      type: String,
      default: "08:00",
    },

    scheduledEndTime: {
      type: String,
      default: "",
    },

    isLate: {
      type: Boolean,
      default: false,
    },

    workingHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    // Existing soft-delete fields.
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

    deletedByName: {
      type: String,
      default: null,
    },

    deletedByRole: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

attendanceSchema.index({ isDeleted: 1, createdAt: -1 });
attendanceSchema.index({ workerId: 1, attendanceDate: 1 });
attendanceSchema.index({ attendanceDate: 1, status: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
