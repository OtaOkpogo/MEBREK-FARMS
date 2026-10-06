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
      required: [true, "Flock ID is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    pen: {
      type: String,
      required: [true, "Pen is required"],
      enum: {
        values: PENS,
        message: "Invalid pen selected",
      },
      index: true,
    },

    placementDate: {
      type: Date,
      required: [true, "Placement date is required"],
    },

    startingAgeWeeks: {
      type: Number,
      required: [true, "Starting age is required"],
      min: [0, "Starting age cannot be negative"],
      max: [
        MAX_LAYING_AGE_WEEKS,
        `Starting age cannot exceed ${MAX_LAYING_AGE_WEEKS} weeks`,
      ],
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
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);

/*
|--------------------------------------------------------------------------
| INDEXES
|--------------------------------------------------------------------------
*/

// Only ONE active, non-deleted flock can occupy a pen.
flockSchema.index(
  { pen: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "ACTIVE",
      isDeleted: false,
    },
  },
);

// Useful for production/history queries.
flockSchema.index({ placementDate: -1 });

/*
|--------------------------------------------------------------------------
| VIRTUALS
|--------------------------------------------------------------------------
*/

// Current flock age in weeks.
flockSchema.virtual("currentAgeWeeks").get(function () {
  if (!this.placementDate) {
    return this.startingAgeWeeks || 0;
  }

  const now = new Date();
  const placementDate = new Date(this.placementDate);

  const diffMs = now.getTime() - placementDate.getTime();
  const elapsedWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);

  return Math.max(0, Math.floor((this.startingAgeWeeks || 0) + elapsedWeeks));
});

// Weeks remaining until maximum laying age.
flockSchema.virtual("weeksRemaining").get(function () {
  const currentAge = this.currentAgeWeeks || 0;

  return Math.max(0, MAX_LAYING_AGE_WEEKS - currentAge);
});

// Expected end of lay.
flockSchema.virtual("expectedEndOfLay").get(function () {
  if (!this.placementDate) {
    return null;
  }

  const endDate = new Date(this.placementDate);

  const totalWeeks = MAX_LAYING_AGE_WEEKS - (this.startingAgeWeeks || 0);

  endDate.setDate(endDate.getDate() + totalWeeks * 7);

  return endDate;
});

// Human-readable lifecycle status.
flockSchema.virtual("lifecycleStatus").get(function () {
  if (this.status === "SOLD") {
    return "Sold / Depopulated";
  }

  const age = this.currentAgeWeeks || 0;

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

module.exports = mongoose.model("Flock", flockSchema);

module.exports.PENS = PENS;
module.exports.MAX_LAYING_AGE_WEEKS = MAX_LAYING_AGE_WEEKS;
