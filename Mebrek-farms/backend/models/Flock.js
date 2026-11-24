const mongoose = require("mongoose");

const MAX_LAYING_AGE_WEEKS = 104;

const PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Deep Litter Pen 4",
  "Deep Litter Pen 5",
  "Sick Bay",
  "Pen 150",
  "Brooding House",
];

const flockSchema = new mongoose.Schema(
  {
    flockId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // Legacy field retained for backward compatibility.
    // Current housing is managed through FlockAllocation.
    pen: {
      type: String,
      required: true,
      enum: PENS,
    },

    placementDate: {
      type: Date,
      required: true,
    },

    startingAgeWeeks: {
      type: Number,
      required: true,
      min: 0,
      max: MAX_LAYING_AGE_WEEKS,
    },

    // null = population not yet recorded.
    // 0 = population is confirmed to be zero.
    initialBirdCount: {
      type: Number,
      default: null,
      min: [0, "Initial bird count cannot be negative"],
      validate: {
        validator: (value) =>
          value === null || (Number.isInteger(value) && value >= 0),
        message: "Initial bird count must be a non-negative whole number.",
      },
    },

    populationTrackingStatus: {
      type: String,
      enum: ["NOT_SET", "TRACKED"],
      default: "NOT_SET",
      index: true,
    },

    status: {
      type: String,
      enum: ["ACTIVE", "SOLD"],
      default: "ACTIVE",
      index: true,
    },

    saleDate: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Multiple flocks may occupy the same pen.
// There is intentionally no unique index on pen.

flockSchema.index({ placementDate: -1 });
flockSchema.index({ status: 1, isDeleted: 1 });

flockSchema.virtual("currentAgeWeeks").get(function () {
  if (!this.placementDate) return null;

  const elapsed = Date.now() - new Date(this.placementDate).getTime();

  const elapsedWeeks = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000));

  return Math.max(0, Number(this.startingAgeWeeks || 0) + elapsedWeeks);
});

flockSchema.virtual("weeksRemaining").get(function () {
  return Math.max(0, MAX_LAYING_AGE_WEEKS - Number(this.currentAgeWeeks || 0));
});

flockSchema.virtual("expectedEndOfLay").get(function () {
  if (!this.placementDate) return null;

  const remainingWeeks = Math.max(
    0,
    MAX_LAYING_AGE_WEEKS - Number(this.startingAgeWeeks || 0),
  );

  const endDate = new Date(this.placementDate);

  endDate.setDate(endDate.getDate() + remainingWeeks * 7);

  return endDate;
});

flockSchema.virtual("lifecycleStatus").get(function () {
  if (this.status === "SOLD") {
    return "Sold / Depopulated";
  }

  const age = Number(this.currentAgeWeeks || 0);

  if (age >= MAX_LAYING_AGE_WEEKS) {
    return "Ready for Sale";
  }

  if (age >= 96) {
    return "Approaching End of Lay";
  }

  if (age < 18) {
    return "Growing / Not Yet Laying";
  }

  return "Laying";
});

const Flock = mongoose.model("Flock", flockSchema);

module.exports = Flock;
module.exports.PENS = PENS;
module.exports.MAX_LAYING_AGE_WEEKS = MAX_LAYING_AGE_WEEKS;
