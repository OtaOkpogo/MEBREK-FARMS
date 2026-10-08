const mongoose = require("mongoose");
const PENS = require("../constants/pens");

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
    // These fields are automatically populated by the production
    // controller. The frontend should NOT be trusted to provide them.
    //
    // flock       = actual Flock document reference
    // flockId     = permanent snapshot of the flock's human-readable ID
    // flockAgeWeeks = flock age at the time this production was recorded
    //
    // Keeping flockId and flockAgeWeeks on the production record
    // preserves historical production information even after the
    // flock is sold or replaced.
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
    // Decimal values are intentionally allowed.
    //
    // Examples:
    // 0
    // 0.5
    // 1
    // 1.25
    // 2.5
    // 10
    // ============================================================

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

// Flock-related indexes
productionSchema.index({ flock: 1, date: -1 });

productionSchema.index({ flockId: 1, date: -1 });

productionSchema.index({ flockAgeWeeks: 1 });

// Existing protection against duplicate production
// entries for the same pen on the same date.
productionSchema.index({ date: 1, pen: 1 }, { unique: true });

productionSchema.index({ remarks: "text" });

module.exports = mongoose.model("Production", productionSchema);
