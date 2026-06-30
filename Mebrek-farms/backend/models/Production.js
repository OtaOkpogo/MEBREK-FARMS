const mongoose = require("mongoose");

const productionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    pen: {
      type: String,
      required: true,
      enum: [
        "Battery Cage Row 1",
        "Battery Cage Row 2",
        "Battery Cage Row 3",
        "Deep Litter Pen 1",
        "Deep Litter Pen 2",
        "Deep Litter Pen 3",
        "Sick Bay",
        "Pen 150",
      ],
    },

    days: {
      type: Number,
      required: true,
    },

    openingStock: {
      type: Number,
      required: true,
    },

    mortality: {
      type: Number,
      default: 0,
    },

    closingStock: {
      type: Number,
      default: 0,
    },

    sickBirds: {
      type: Number,
      default: 0,
    },

    feedBagsConsumed: {
      type: Number,
      default: 0,
    },

    waterConsumed: {
      type: Number,
      default: 0,
    },

    drugsUsed: {
      type: String,
      default: "",
    },

    cratesProduced: {
      type: Number,
      default: 0,
    },

    extraEggPieces: {
      type: Number,
      default: 0,
    },

    totalEggs: {
      type: Number,
      default: 0,
    },

    productionPercentage: {
      type: Number,
      default: 0,
    },

    miscarriageProduction: {
      type: Number,
      default: 0,
    },

    crackedEggs: {
      type: Number,
      default: 0,
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

module.exports = mongoose.model("Production", productionSchema);
