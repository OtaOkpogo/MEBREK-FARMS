const mongoose = require("mongoose");

const vaccinationSchema =
  new mongoose.Schema(
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
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "Vaccination",
  vaccinationSchema
);
