const Worker = require("../models/Worker");

// ============================================================
// HELPER: Normalize old worker fields to new field names
// ============================================================

const normalizeWorker = (worker) => {
  if (!worker) return worker;

  const workerObj = worker.toObject ? worker.toObject() : { ...worker };

  // Backward compatibility:
  // Old schema used dateHired
  // New schema uses hireDate
  if (!workerObj.hireDate && workerObj.dateHired) {
    workerObj.hireDate = workerObj.dateHired;
  }

  // Backward compatibility:
  // Old schema used nextOfKin
  // New schema uses nextOfKinName
  if (!workerObj.nextOfKinName && workerObj.nextOfKin) {
    workerObj.nextOfKinName = workerObj.nextOfKin;
  }

  // Old schema used notes
  // New schema uses remarks
  if (!workerObj.remarks && workerObj.notes) {
    workerObj.remarks = workerObj.notes;
  }

  return workerObj;
};

// ============================================================
// CREATE WORKER
// ============================================================

exports.createWorker = async (req, res) => {
  try {
    const data = { ...req.body };

    // --------------------------------------------------------
    // Backward compatibility for old frontend requests
    // --------------------------------------------------------

    if (!data.hireDate && data.dateHired) {
      data.hireDate = data.dateHired;
    }

    if (!data.nextOfKinName && data.nextOfKin) {
      data.nextOfKinName = data.nextOfKin;
    }

    if (!data.remarks && data.notes) {
      data.remarks = data.notes;
    }

    // --------------------------------------------------------
    // Normalize Employee ID
    // --------------------------------------------------------

    if (data.employeeId) {
      data.employeeId = String(data.employeeId).trim();
    }

    // --------------------------------------------------------
    // Create Worker
    // --------------------------------------------------------

    const worker = await Worker.create(data);

    res.status(201).json(normalizeWorker(worker));
  } catch (err) {
    console.error("CREATE WORKER ERROR:", err);

    // Duplicate employee ID
    if (err.code === 11000) {
      return res.status(400).json({
        error: "Employee ID already exists",
        field: "employeeId",
      });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: Object.values(err.errors).map((error) => error.message),
      });
    }

    res.status(500).json({
      error: err.message || "Failed to create worker",
    });
  }
};

// ============================================================
// GET ALL WORKERS
// ============================================================

exports.getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find().sort({ createdAt: -1 }).lean();

    const normalizedWorkers = workers.map(normalizeWorker);

    res.json(normalizedWorkers);
  } catch (err) {
    console.error("GET WORKERS ERROR:", err);

    res.status(500).json({
      error: err.message || "Failed to fetch workers",
    });
  }
};

// ============================================================
// GET SINGLE WORKER
// ============================================================

exports.getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        error: "Worker not found",
      });
    }

    res.json(normalizeWorker(worker));
  } catch (err) {
    console.error("GET WORKER ERROR:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        error: "Invalid worker ID",
      });
    }

    res.status(500).json({
      error: err.message || "Failed to fetch worker",
    });
  }
};

// ============================================================
// UPDATE WORKER
// ============================================================

exports.updateWorker = async (req, res) => {
  try {
    const data = { ...req.body };

    // --------------------------------------------------------
    // Backward compatibility
    // --------------------------------------------------------

    if (!data.hireDate && data.dateHired) {
      data.hireDate = data.dateHired;
    }

    if (!data.nextOfKinName && data.nextOfKin) {
      data.nextOfKinName = data.nextOfKin;
    }

    if (!data.remarks && data.notes) {
      data.remarks = data.notes;
    }

    // --------------------------------------------------------
    // Normalize Employee ID
    // --------------------------------------------------------

    if (data.employeeId) {
      data.employeeId = String(data.employeeId).trim();
    }

    // --------------------------------------------------------
    // Update Worker
    // --------------------------------------------------------

    const worker = await Worker.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });

    if (!worker) {
      return res.status(404).json({
        error: "Worker not found",
      });
    }

    res.json(normalizeWorker(worker));
  } catch (err) {
    console.error("UPDATE WORKER ERROR:", err);

    // Duplicate employee ID
    if (err.code === 11000) {
      return res.status(400).json({
        error: "Employee ID already exists",
        field: "employeeId",
      });
    }

    // Invalid ObjectId
    if (err.name === "CastError") {
      return res.status(400).json({
        error: "Invalid worker ID",
      });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: Object.values(err.errors).map((error) => error.message),
      });
    }

    res.status(500).json({
      error: err.message || "Failed to update worker",
    });
  }
};

// ============================================================
// DELETE WORKER
// ============================================================

exports.deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);

    if (!worker) {
      return res.status(404).json({
        error: "Worker not found",
      });
    }

    res.json({
      message: "Worker deleted successfully",
      worker: normalizeWorker(worker),
    });
  } catch (err) {
    console.error("DELETE WORKER ERROR:", err);

    if (err.name === "CastError") {
      return res.status(400).json({
        error: "Invalid worker ID",
      });
    }

    res.status(500).json({
      error: err.message || "Failed to delete worker",
    });
  }
};

// ============================================================
// WORKER ANALYTICS / STATS
// ============================================================

exports.getWorkerStats = async (req, res) => {
  try {
    // --------------------------------------------------------
    // Basic Worker Counts
    // --------------------------------------------------------

    const totalWorkers = await Worker.countDocuments();

    const activeWorkers = await Worker.countDocuments({
      status: "Active",
    });

    const inactiveWorkers = await Worker.countDocuments({
      status: "Inactive",
    });

    const suspendedWorkers = await Worker.countDocuments({
      status: "Suspended",
    });

    const terminatedWorkers = await Worker.countDocuments({
      status: "Terminated",
    });

    const workersOnLeave = await Worker.countDocuments({
      status: "On Leave",
    });

    // --------------------------------------------------------
    // Salary Statistics
    // --------------------------------------------------------

    const salaryStats = await Worker.aggregate([
      {
        $group: {
          _id: null,

          totalSalary: {
            $sum: {
              $ifNull: ["$salary", 0],
            },
          },

          averageSalary: {
            $avg: {
              $ifNull: ["$salary", 0],
            },
          },

          highestSalary: {
            $max: {
              $ifNull: ["$salary", 0],
            },
          },

          lowestSalary: {
            $min: {
              $ifNull: ["$salary", 0],
            },
          },
        },
      },
    ]);

    const salaryData = salaryStats[0] || {};

    const totalSalary = salaryData.totalSalary || 0;

    const avgSalary = Math.round(salaryData.averageSalary || 0);

    const highestSalary = salaryData.highestSalary || 0;

    const lowestSalary = salaryData.lowestSalary || 0;

    // --------------------------------------------------------
    // Department Statistics
    // --------------------------------------------------------

    const departmentStats = await Worker.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$department", "Unassigned"],
          },

          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // Role Statistics
    // --------------------------------------------------------

    const roleStats = await Worker.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$role", "Unassigned"],
          },

          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // Employment Type Statistics
    // --------------------------------------------------------

    const employmentTypeStats = await Worker.aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$employmentType", "Unspecified"],
          },

          count: {
            $sum: 1,
          },
        },
      },

      {
        $sort: {
          count: -1,
        },
      },
    ]);

    // --------------------------------------------------------
    // Recent Workers
    // --------------------------------------------------------

    const recentWorkers = await Worker.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const normalizedRecentWorkers = recentWorkers.map(normalizeWorker);

    // --------------------------------------------------------
    // Final Response
    // --------------------------------------------------------

    res.json({
      // Worker counts
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      suspendedWorkers,
      terminatedWorkers,
      workersOnLeave,

      // Salary
      totalSalary,

      // Current frontend expects avgSalary
      avgSalary,

      // Backward-compatible property
      averageSalary: avgSalary,

      highestSalary,
      lowestSalary,

      // Analytics
      departmentStats,
      roleStats,
      employmentTypeStats,

      // Recent workers
      recentWorkers: normalizedRecentWorkers,
    });
  } catch (err) {
    console.error("GET WORKER STATS ERROR:", err);

    res.status(500).json({
      error: err.message || "Failed to load worker statistics",
    });
  }
};

// ============================================================
// SEARCH WORKERS
// ============================================================

exports.searchWorkers = async (req, res) => {
  try {
    const search = req.query.search?.trim();

    if (!search) {
      return res.json([]);
    }

    const regex = new RegExp(search, "i");

    const workers = await Worker.find({
      $or: [
        {
          firstName: regex,
        },
        {
          lastName: regex,
        },
        {
          employeeId: regex,
        },
        {
          role: regex,
        },
        {
          department: regex,
        },
        {
          phone: regex,
        },
        {
          email: regex,
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .limit(50)
      .lean();

    res.json(workers.map(normalizeWorker));
  } catch (err) {
    console.error("SEARCH WORKERS ERROR:", err);

    res.status(500).json({
      error: err.message || "Failed to search workers",
    });
  }
};
