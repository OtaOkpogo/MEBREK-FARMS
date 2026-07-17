const mongoose = require("mongoose");

const vaccinationSchema = new mongoose.Schema(
  {
    vaccineName: {
      type: String,
      required: true,
    },

    birdBatch: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
    },

    administeredBy: {
      type: String,
    },

    dosage: {
      type: String,
    },

    nextDueDate: {
      type: Date,
    },

    notes: {
      type: String,
    },

    // ---- Soft delete, matching the Medications/BirdHealth pattern ----
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
  },
  {
    timestamps: true,
  },
);

vaccinationSchema.index({ isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model("Vaccination", vaccinationSchema);
