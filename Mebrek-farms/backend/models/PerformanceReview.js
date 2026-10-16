
const mongoose = require("mongoose");

const performanceReviewSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true,
    },

    reviewDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    reviewerName: {
      type: String,
      trim: true,
      default: "",
    },

    reviewPeriod: {
      type: String,
      trim: true,
      default: "",
    },

    overallRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    categories: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        comments: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],

    strengths: {
      type: String,
      trim: true,
      default: "",
    },

    areasForImprovement: {
      type: String,
      trim: true,
      default: "",
    },

    goals: {
      type: String,
      trim: true,
      default: "",
    },

    comments: {
      type: String,
      trim: true,
      default: "",
    },

    nextReviewDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Draft", "Completed"],
      default: "Completed",
    },
  },
  { timestamps: true }
);

performanceReviewSchema.index({
  workerId: 1,
  reviewDate: -1,
});

module.exports = mongoose.model(
  "PerformanceReview",
  performanceReviewSchema
);

