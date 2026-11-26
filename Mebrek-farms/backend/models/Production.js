const mongoose = require("mongoose");
const PENS = require("../constants/pens");

// ============================================================
// PRODUCTION MORTALITY ALLOCATION
// ============================================================

const mortalityAllocationSchema = new mongoose.Schema(
  {
    allocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlockAllocation",
      required: true,
    },

    numberDead: {
      type: Number,
      required: true,
      min: [0, "numberDead cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "numberDead must be a whole number",
      },
    },
  },
  { _id: false },
);

const productionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    pen: {
      type: String,
      required: true,
      enum: PENS,
    },

    // ============================================================
    // FLOCK ASSOCIATION
    // ============================================================

    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
      default: null,
    },

    flockId: {
      type: String,
      default: null,
      trim: true,
    },

    flockAgeWeeks: {
      type: Number,
      default: null,
      min: [0, "flockAgeWeeks cannot be negative"],
    },

    days: {
      type: Number,
      required: true,
      min: [0, "days cannot be negative"],
    },

    openingStock: {
      type: Number,
      required: true,
      min: [0, "openingStock cannot be negative"],
    },

    transferIn: {
      type: Number,
      default: 0,
      min: [0, "transferIn cannot be negative"],
    },

    transferOut: {
      type: Number,
      default: 0,
      min: [0, "transferOut cannot be negative"],
    },

    mortality: {
      type: Number,
      default: 0,
      min: [0, "mortality cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "mortality must be a whole number",
      },
    },

    // ============================================================
    // MORTALITY ALLOCATION BREAKDOWN
    // ============================================================
    // A production record represents a pen for a particular day.
    // Mortality must therefore be assigned explicitly to the
    // relevant flock allocations when multiple flocks share a pen.
    //
    // An empty array is permitted for legacy records. New production
    // mortality entries will be validated by the controller.
    // ============================================================

    mortalityAllocations: {
      type: [mortalityAllocationSchema],
      default: [],
      validate: {
        validator: function (allocations) {
          if (!allocations || allocations.length === 0) {
            return true;
          }

          const totalAllocated = allocations.reduce(
            (total, item) => total + item.numberDead,
            0,
          );

          return totalAllocated === this.mortality;
        },
        message:
          "The total mortality allocation must equal the production mortality.",
      },
    },

    mortalityRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mortality",
      default: null,
    },

    closingStock: {
      type: Number,
      default: 0,
      min: [0, "closingStock cannot be negative"],
    },

    sickBirds: {
      type: Number,
      default: 0,
      min: [0, "sickBirds cannot be negative"],
    },

    // ============================================================
    // FEED
    // ============================================================

    feedUsed: {
      feed: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Feed",
        default: null,
      },

      feedName: {
        type: String,
        default: "",
        trim: true,
      },
    },

    feedBagsConsumed: {
      type: Number,
      default: 0,
      min: [0, "feedBagsConsumed cannot be negative"],
    },

    waterConsumed: {
      type: Number,
      default: 0,
      min: [0, "waterConsumed cannot be negative"],
    },

    drugsUsed: {
      type: String,
      default: "",
    },

    cratesProduced: {
      type: Number,
      default: 0,
      min: [0, "cratesProduced cannot be negative"],
    },

    extraEggPieces: {
      type: Number,
      default: 0,
      min: [0, "extraEggPieces cannot be negative"],
    },

    totalEggs: {
      type: Number,
      default: 0,
      min: [0, "totalEggs cannot be negative"],
    },

    productionPercentage: {
      type: Number,
      default: 0,
    },

    miscarriageProduction: {
      type: Number,
      default: 0,
      min: [0, "miscarriageProduction cannot be negative"],
    },

    crackedEggs: {
      type: Number,
      default: 0,
      min: [0, "crackedEggs cannot be negative"],
    },

    remarks: {
      type: String,
      default: "",
    },

    // ============================================================
    // SOFT DELETE
    // ============================================================

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
      },

      name: {
        type: String,
        default: "",
      },

      role: {
        type: String,
        default: "",
      },
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// ============================================================
// INDEXES
// ============================================================

productionSchema.index({ date: -1 });
productionSchema.index({ createdAt: -1 });
productionSchema.index({ pen: 1, date: -1 });
productionSchema.index({ isDeleted: 1, date: -1 });
productionSchema.index({ isDeleted: 1, pen: 1, date: -1 });

productionSchema.index({ flock: 1, date: -1 });
productionSchema.index({ flockId: 1, date: -1 });
productionSchema.index({ flockAgeWeeks: 1 });

productionSchema.index({ "mortalityAllocations.allocation": 1 });

productionSchema.index({ date: 1, pen: 1 }, { unique: true });

productionSchema.index({ remarks: "text" });

module.exports = mongoose.model("Production", productionSchema);
