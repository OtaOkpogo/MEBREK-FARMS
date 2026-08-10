const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    workerName: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Present", "Absent", "Late"],
      default: "Present",
    },

    // ---- Soft delete, matching BirdHealth/Vaccinations pattern ----
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

// Filter active-only records, sorted by most recent (the common list query)
attendanceSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
