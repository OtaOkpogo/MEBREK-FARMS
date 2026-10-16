const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getWorkerAttendanceSummary,
  getPerformanceReviews,
  createPerformanceReview,
  updatePerformanceReview,
  deletePerformanceReview,
  getEmploymentHistory,
  getAdvancedWorkerAnalytics,
} = require("../controllers/workerFeaturesController");

// Restrict worker-management features to superadmins.
router.use(protect, allowRoles("superadmin"));

// Advanced workforce analytics — register before /:id routes.
router.get("/analytics/summary", getAdvancedWorkerAnalytics);

// Attendance
router.get("/:id/attendance-summary", getWorkerAttendanceSummary);

// Performance reviews
router.get("/:id/reviews", getPerformanceReviews);
router.post("/:id/reviews", createPerformanceReview);
router.put("/:id/reviews/:reviewId", updatePerformanceReview);
router.delete("/:id/reviews/:reviewId", deletePerformanceReview);

// Employment history
router.get("/:id/employment-history", getEmploymentHistory);

module.exports = router;
