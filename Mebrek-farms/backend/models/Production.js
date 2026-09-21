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

productionSchema.index({ date: -1 });

productionSchema.index({ createdAt: -1 });

productionSchema.index({ pen: 1, date: -1 });

productionSchema.index({ isDeleted: 1, date: -1 });

productionSchema.index({ isDeleted: 1, pen: 1, date: -1 });

// Prevent duplicate entries for the same pen on the same day
productionSchema.index({ date: 1, pen: 1 }, { unique: true });

productionSchema.index({ remarks: "text" });

module.exports = mongoose.model("Production", productionSchema);
