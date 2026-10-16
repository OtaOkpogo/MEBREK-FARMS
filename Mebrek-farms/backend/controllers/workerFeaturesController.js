const mongoose = require("mongoose");

const Worker = require("../models/Worker");
const Attendance = require("../models/Attendance");
const PerformanceReview = require("../models/PerformanceReview");
const EmploymentHistory = require("../models/EmploymentHistory");

const isValidId = (id) => mongoose.isValidObjectId(id);

const getActor = (req) => ({
  changedById: req.user?._id || req.user?.id || null,
  changedByName: req.user?.name || req.user?.adminName || req.user?.email || "",
  changedByRole: req.user?.role || "",
});

const findWorker = async (workerId) => {
  if (!isValidId(workerId)) return null;
  return Worker.findById(workerId);
};

// ============================================================
// WORKER ATTENDANCE SUMMARY
// GET /api/workers/:id/attendance-summary
// ============================================================

exports.getWorkerAttendanceSummary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid worker ID" });
    }

    const worker = await Worker.findById(id).select(
      "employeeId firstName lastName role department status",
    );

    if (!worker) {
      return res.status(404).json({ message: "Worker not found" });
    }

    const filter = {
      workerId: worker._id,
      isDeleted: false,
    };

    const { startDate, endDate } = req.query;

    const validDate = (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

    if (startDate && !validDate(startDate)) {
      return res.status(400).json({
        message: "startDate must use YYYY-MM-DD format",
      });
    }

    if (endDate && !validDate(endDate)) {
      return res.status(400).json({
        message: "endDate must use YYYY-MM-DD format",
      });
    }

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({
        message: "startDate cannot be later than endDate",
      });
    }

    if (startDate || endDate) {
      filter.attendanceDate = {};

      if (startDate) filter.attendanceDate.$gte = startDate;
      if (endDate) filter.attendanceDate.$lte = endDate;
    }

    const records = await Attendance.find(filter)
      .sort({ attendanceDate: -1, createdAt: -1 })
      .lean();

    const counts = {
      totalRecords: records.length,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      sickLeave: 0,
      holiday: 0,
      offDay: 0,
      other: 0,
    };

    let totalWorkingHours = 0;
    let recordsWithWorkingHours = 0;
    let lateArrivalCount = 0;

    for (const record of records) {
      switch (record.status) {
        case "Present":
          counts.present += 1;
          break;
        case "Late":
          counts.late += 1;
          break;
        case "Absent":
          counts.absent += 1;
          break;
        case "Leave":
          counts.leave += 1;
          break;
        case "Sick Leave":
          counts.sickLeave += 1;
          break;
        case "Holiday":
          counts.holiday += 1;
          break;
        case "Off Day":
          counts.offDay += 1;
          break;
        default:
          counts.other += 1;
      }

      if (record.isLate || record.status === "Late") {
        lateArrivalCount += 1;
      }

      const hours = Number(record.workingHours);

      if (Number.isFinite(hours) && hours > 0) {
        totalWorkingHours += hours;
        recordsWithWorkingHours += 1;
      }
    }

    // Only Present, Late and Absent count as recorded workdays.
    // Leave, Sick Leave, Holiday and Off Day are excluded.
    const recordedWorkdays = counts.present + counts.late + counts.absent;

    const attendedWorkdays = counts.present + counts.late;

    const attendanceRate =
      recordedWorkdays > 0
        ? Math.round((attendedWorkdays / recordedWorkdays) * 10000) / 100
        : null;

    const punctualityRate =
      attendedWorkdays > 0
        ? Math.round(
            ((attendedWorkdays - lateArrivalCount) / attendedWorkdays) * 10000,
          ) / 100
        : null;

    return res.json({
      worker: {
        _id: worker._id,
        employeeId: worker.employeeId,
        name: `${worker.firstName} ${worker.lastName}`.trim(),
        role: worker.role,
        department: worker.department,
        status: worker.status,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      counts,
      recordedWorkdays,
      attendedWorkdays,
      lateArrivalCount,
      attendanceRate,
      punctualityRate,
      totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
      averageWorkingHours:
        recordsWithWorkingHours > 0
          ? Math.round((totalWorkingHours / recordsWithWorkingHours) * 100) /
            100
          : null,
      records,
    });
  } catch (err) {
    console.error("GET WORKER ATTENDANCE SUMMARY ERROR:", err);
    return res.status(500).json({
      message: "Failed to load worker attendance summary",
    });
  }
};

// ============================================================
// LIST PERFORMANCE REVIEWS
// GET /api/workers/:id/reviews
// ============================================================

exports.getPerformanceReviews = async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);

    if (!worker) {
      return res.status(isValidId(req.params.id) ? 404 : 400).json({
        message: isValidId(req.params.id)
          ? "Worker not found"
          : "Invalid worker ID",
      });
    }

    const reviews = await PerformanceReview.find({
      workerId: worker._id,
    })
      .sort({ reviewDate: -1, createdAt: -1 })
      .lean();

    return res.json(reviews);
  } catch (err) {
    console.error("GET PERFORMANCE REVIEWS ERROR:", err);
    return res.status(500).json({
      message: "Failed to load performance reviews",
    });
  }
};

// ============================================================
// CREATE PERFORMANCE REVIEW
// POST /api/workers/:id/reviews
// ============================================================

exports.createPerformanceReview = async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);

    if (!worker) {
      return res.status(isValidId(req.params.id) ? 404 : 400).json({
        message: isValidId(req.params.id)
          ? "Worker not found"
          : "Invalid worker ID",
      });
    }

    const {
      reviewDate,
      reviewPeriod,
      overallRating,
      categories,
      strengths,
      areasForImprovement,
      goals,
      comments,
      nextReviewDate,
      status,
    } = req.body;

    const rating = Number(overallRating);

    if (
      overallRating === undefined ||
      overallRating === "" ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return res.status(400).json({
        message: "Overall rating must be between 1 and 5",
      });
    }

    if (categories !== undefined && !Array.isArray(categories)) {
      return res.status(400).json({
        message: "Categories must be an array",
      });
    }

    const actor = getActor(req);

    const review = await PerformanceReview.create({
      workerId: worker._id,
      reviewDate: reviewDate || new Date(),
      reviewerId: actor.changedById,
      reviewerName: actor.changedByName,
      reviewPeriod,
      overallRating: rating,
      categories,
      strengths,
      areasForImprovement,
      goals,
      comments,
      nextReviewDate: nextReviewDate || null,
      status: status || "Completed",
    });

    return res.status(201).json({
      message: "Performance review created successfully",
      review,
    });
  } catch (err) {
    console.error("CREATE PERFORMANCE REVIEW ERROR:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
      });
    }

    return res.status(500).json({
      message: "Failed to create performance review",
    });
  }
};

// ============================================================
// UPDATE PERFORMANCE REVIEW
// PUT /api/workers/:id/reviews/:reviewId
// ============================================================

exports.updatePerformanceReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;

    if (!isValidId(id) || !isValidId(reviewId)) {
      return res.status(400).json({
        message: "Invalid worker or review ID",
      });
    }

    const review = await PerformanceReview.findOne({
      _id: reviewId,
      workerId: id,
    });

    if (!review) {
      return res.status(404).json({
        message: "Performance review not found",
      });
    }

    const allowedFields = [
      "reviewDate",
      "reviewPeriod",
      "overallRating",
      "categories",
      "strengths",
      "areasForImprovement",
      "goals",
      "comments",
      "nextReviewDate",
      "status",
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        review.set(field, req.body[field]);
      }
    }

    await review.save();

    return res.json({
      message: "Performance review updated successfully",
      review,
    });
  } catch (err) {
    console.error("UPDATE PERFORMANCE REVIEW ERROR:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: err.message,
      });
    }

    return res.status(500).json({
      message: "Failed to update performance review",
    });
  }
};

// ============================================================
// DELETE PERFORMANCE REVIEW
// DELETE /api/workers/:id/reviews/:reviewId
// ============================================================

exports.deletePerformanceReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;

    if (!isValidId(id) || !isValidId(reviewId)) {
      return res.status(400).json({
        message: "Invalid worker or review ID",
      });
    }

    const review = await PerformanceReview.findOneAndDelete({
      _id: reviewId,
      workerId: id,
    });

    if (!review) {
      return res.status(404).json({
        message: "Performance review not found",
      });
    }

    return res.json({
      message: "Performance review deleted successfully",
    });
  } catch (err) {
    console.error("DELETE PERFORMANCE REVIEW ERROR:", err);
    return res.status(500).json({
      message: "Failed to delete performance review",
    });
  }
};

// ============================================================
// EMPLOYMENT HISTORY
// GET /api/workers/:id/employment-history
// ============================================================

exports.getEmploymentHistory = async (req, res) => {
  try {
    const worker = await findWorker(req.params.id);

    if (!worker) {
      return res.status(isValidId(req.params.id) ? 404 : 400).json({
        message: isValidId(req.params.id)
          ? "Worker not found"
          : "Invalid worker ID",
      });
    }

    const history = await EmploymentHistory.find({
      workerId: worker._id,
    })
      .sort({ effectiveDate: -1, createdAt: -1 })
      .lean();

    return res.json(history);
  } catch (err) {
    console.error("GET EMPLOYMENT HISTORY ERROR:", err);
    return res.status(500).json({
      message: "Failed to load employment history",
    });
  }
};

exports.getAdvancedWorkerAnalytics = async (req, res) => {
  try {
    const [
      salaryByFrequency,
      departmentBreakdown,
      statusBreakdown,
      employmentTypeBreakdown,
      workersForTenure,
      recentHires,
    ] = await Promise.all([
      Worker.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$paymentFrequency", "Other"] },
            workerCount: { $sum: 1 },
            totalSalary: { $sum: { $ifNull: ["$salary", 0] } },
            averageSalary: { $avg: { $ifNull: ["$salary", 0] } },
          },
        },
        { $sort: { workerCount: -1 } },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$department", "Unassigned"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$status", "Unspecified"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: { $ifNull: ["$employmentType", "Unspecified"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.find({}, "hireDate createdAt status").lean(),

      Worker.find({})
        .sort({ hireDate: -1, createdAt: -1 })
        .limit(10)
        .select("employeeId firstName lastName role department hireDate status")
        .lean(),
    ]);

    const now = new Date();
    const tenure = {
      under3Months: 0,
      from3To12Months: 0,
      from1To3Years: 0,
      over3Years: 0,
      unknown: 0,
    };

    for (const worker of workersForTenure) {
      const start = worker.hireDate || worker.createdAt;
      const startDate = start ? new Date(start) : null;

      if (!startDate || Number.isNaN(startDate.getTime())) {
        tenure.unknown += 1;
        continue;
      }

      const months =
        (now.getFullYear() - startDate.getFullYear()) * 12 +
        now.getMonth() -
        startDate.getMonth();

      if (months < 3) tenure.under3Months += 1;
      else if (months < 12) tenure.from3To12Months += 1;
      else if (months < 36) tenure.from1To3Years += 1;
      else tenure.over3Years += 1;
    }

    return res.json({
      generatedAt: now.toISOString(),
      totalWorkers: workersForTenure.length,
      salaryByFrequency,
      departmentBreakdown,
      statusBreakdown,
      employmentTypeBreakdown,
      tenure,
      recentHires,
    });
  } catch (err) {
    console.error("GET ADVANCED WORKER ANALYTICS ERROR:", err);
    return res.status(500).json({
      message: "Failed to load advanced worker analytics",
    });
  }
};
