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

    // NOTE: derived from totalEggs / openingStock (roughly).
    // Recompute in the controller/service whenever totalEggs or
    // openingStock changes — this field is a cached value, not
    // auto-calculated by Mongoose.
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

    // ================= SOFT DELETE =================

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

// ================= INDEXES =================

// Sort by date only (e.g. default list view, newest first)
productionSchema.index({ date: -1 });

// Sort by most recently created (e.g. "recently added entries")
productionSchema.index({ createdAt: -1 });

// Filter by pen, sorted by date (e.g. pen history view)
productionSchema.index({ pen: 1, date: -1 });

// Filter active-only records, sorted by date (most common list query)
productionSchema.index({ isDeleted: 1, date: -1 });

// Filter active + specific pen, sorted by date
productionSchema.index({ isDeleted: 1, pen: 1, date: -1 });

// Prevent duplicate entries for the same pen on the same day
// ⚠️ Before deploying: check your existing data for duplicate
// (date, pen) pairs, or this index creation will fail with a
// duplicate-key error. Run this first:
//
// db.productions.aggregate([
//   { $group: { _id: { date: "$date", pen: "$pen" }, count: { $sum: 1 } } },
//   { $match: { count: { $gt: 1 } } }
// ])
productionSchema.index({ date: 1, pen: 1 }, { unique: true });

// Free-text search on remarks only (pen is an enum, not free text;
// paymentStatus removed — it doesn't exist on this schema, it belongs
// to the EggSale model)
productionSchema.index({ remarks: "text" });

module.exports = mongoose.model("Production", productionSchema);
