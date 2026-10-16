const Worker = require("../models/Worker");
const EmploymentHistory = require("../models/EmploymentHistory");

// ============================================================
// EMPLOYMENT HISTORY CONFIGURATION
// ============================================================

const EMPLOYMENT_HISTORY_FIELDS = [
  "role",
  "department",
  "status",
  "employmentType",
  "salary",
  "paymentFrequency",
  "supervisor",
  "assignedFarmArea",
];

/**
 * Record an employment-related change.
 *
 * History is best-effort: a history failure should not prevent
 * an otherwise valid worker operation from succeeding.
 */
async function recordEmploymentHistory({
  workerId,
  changeType,
  previousValues = {},
  newValues = {},
  req,
  notes = "",
}) {
  const actor = req?.user || {};

  return EmploymentHistory.create({
    workerId,
    changeType,
    effectiveDate: new Date(),
    previousValues,
    newValues,
    notes,
    changedById: actor._id || actor.id || null,
    changedByName: actor.name || actor.adminName || actor.email || "",
    changedByRole: actor.role || "",
  });
}

// ============================================================
// WORKER NORMALIZATION
// Maintains compatibility with legacy field names.
// ============================================================

function normalizeWorker(worker) {
  if (!worker) return worker;

  const data =
    typeof worker.toObject === "function" ? worker.toObject() : { ...worker };

  // Backward compatibility for older worker records.
  if (!data.hireDate && data.dateHired) {
    data.hireDate = data.dateHired;
  }

  if (
    (data.nextOfKinName === undefined || data.nextOfKinName === "") &&
    data.nextOfKin
  ) {
    data.nextOfKinName = data.nextOfKin;
  }

  if ((data.remarks === undefined || data.remarks === "") && data.notes) {
    data.remarks = data.notes;
  }

  return data;
}

// ============================================================
// CREATE WORKER
// POST /api/workers
// ============================================================

exports.createWorker = async (req, res) => {
  try {
    const data = { ...req.body };

    // Normalize optional fields that may arrive as empty strings.
    if (
      data.bloodGroup !== undefined &&
      data.bloodGroup !== null &&
      String(data.bloodGroup).trim() === ""
    ) {
      data.bloodGroup = undefined;
    }

    if (
      data.idType !== undefined &&
      data.idType !== null &&
      String(data.idType).trim() === ""
    ) {
      data.idType = undefined;
    }

    // Support legacy field names.
    if (!data.hireDate && data.dateHired) {
      data.hireDate = data.dateHired;
    }

    if (
      (data.nextOfKinName === undefined || data.nextOfKinName === "") &&
      data.nextOfKin
    ) {
      data.nextOfKinName = data.nextOfKin;
    }

    if ((data.remarks === undefined || data.remarks === "") && data.notes) {
      data.remarks = data.notes;
    }

    if (data.employeeId !== undefined && data.employeeId !== null) {
      data.employeeId = String(data.employeeId).trim();
    }

    const worker = await Worker.create(data);

    // Automatically create the worker's initial employment record.
    const initialValues = {};

    for (const field of EMPLOYMENT_HISTORY_FIELDS) {
      initialValues[field] = worker[field] ?? null;
    }

    try {
      await recordEmploymentHistory({
        workerId: worker._id,
        changeType: "Hired",
        previousValues: {},
        newValues: initialValues,
        req,
        notes: "Initial employment record created.",
      });
    } catch (historyError) {
      console.error("FAILED TO RECORD NEW HIRE HISTORY:", historyError);
    }

    return res.status(201).json(normalizeWorker(worker));
  } catch (error) {
    console.error("CREATE WORKER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "A worker with this employee ID or unique value already exists.",
        details: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Worker validation failed.",
        details: Object.values(error.errors).map((item) => item.message),
      });
    }

    return res.status(500).json({
      error: "Failed to create worker.",
    });
  }
};

// ============================================================
// GET ALL WORKERS
// GET /api/workers
// ============================================================

exports.getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find().sort({ createdAt: -1 }).lean();

    return res.json(workers.map(normalizeWorker));
  } catch (error) {
    console.error("GET WORKERS ERROR:", error);

    return res.status(500).json({
      error: "Failed to retrieve workers.",
    });
  }
};

// ============================================================
// GET ONE WORKER
// GET /api/workers/:id
// ============================================================

exports.getWorkerById = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        error: "Worker not found.",
      });
    }

    return res.json(normalizeWorker(worker));
  } catch (error) {
    console.error("GET WORKER BY ID ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid worker ID.",
      });
    }

    return res.status(500).json({
      error: "Failed to retrieve worker.",
    });
  }
};

// ============================================================
// UPDATE WORKER
// PUT /api/workers/:id
// Automatically records employment changes.
// ============================================================

exports.updateWorker = async (req, res) => {
  try {
    const data = { ...req.body };

    // Normalize optional fields.
    if (
      data.bloodGroup !== undefined &&
      data.bloodGroup !== null &&
      String(data.bloodGroup).trim() === ""
    ) {
      data.bloodGroup = undefined;
    }

    if (
      data.idType !== undefined &&
      data.idType !== null &&
      String(data.idType).trim() === ""
    ) {
      data.idType = undefined;
    }

    // Support legacy field names.
    if (!data.hireDate && data.dateHired) {
      data.hireDate = data.dateHired;
    }

    if (
      (data.nextOfKinName === undefined || data.nextOfKinName === "") &&
      data.nextOfKin
    ) {
      data.nextOfKinName = data.nextOfKin;
    }

    if ((data.remarks === undefined || data.remarks === "") && data.notes) {
      data.remarks = data.notes;
    }

    if (data.employeeId !== undefined && data.employeeId !== null) {
      data.employeeId = String(data.employeeId).trim();
    }

    const existingWorker = await Worker.findById(req.params.id);

    if (!existingWorker) {
      return res.status(404).json({
        error: "Worker not found.",
      });
    }

    // Compare employment fields before applying the update.
    const previousValues = {};
    const newValues = {};
    const changedFields = [];

    for (const field of EMPLOYMENT_HISTORY_FIELDS) {
      const oldValue = existingWorker[field] ?? null;

      const newValue = Object.prototype.hasOwnProperty.call(data, field)
        ? data[field]
        : existingWorker[field];

      const comparableValue = (value) => {
        if (value === undefined || value === null) return "";

        if (value instanceof Date) {
          return value.toISOString();
        }

        return String(value);
      };

      if (comparableValue(oldValue) !== comparableValue(newValue)) {
        previousValues[field] = oldValue;
        newValues[field] = newValue;
        changedFields.push(field);
      }
    }

    // Save the worker using normal Mongoose validation.
    existingWorker.set(data);

    const worker = await existingWorker.save();

    // Map changed fields to meaningful history event types.
    const changeTypeByField = {
      role: "Role Change",
      department: "Department Change",
      status: "Status Change",
      employmentType: "Employment Type Change",
      salary: "Salary Change",
      paymentFrequency: "Salary Change",
      supervisor: "Supervisor Change",
      assignedFarmArea: "Farm Area Change",
    };

    if (changedFields.length > 0) {
      try {
        const changeTypes = [
          ...new Set(
            changedFields.map(
              (field) => changeTypeByField[field] || "General Update",
            ),
          ),
        ];

        for (const changeType of changeTypes) {
          const fieldsForType = changedFields.filter(
            (field) =>
              (changeTypeByField[field] || "General Update") === changeType,
          );

          const oldSnapshot = {};
          const newSnapshot = {};

          for (const field of fieldsForType) {
            oldSnapshot[field] = previousValues[field];
            newSnapshot[field] = newValues[field];
          }

          await recordEmploymentHistory({
            workerId: worker._id,
            changeType,
            previousValues: oldSnapshot,
            newValues: newSnapshot,
            req,
            notes: `Updated employment fields: ${fieldsForType.join(", ")}`,
          });
        }
      } catch (historyError) {
        console.error("FAILED TO RECORD EMPLOYMENT CHANGE:", historyError);
      }
    }

    return res.json(normalizeWorker(worker));
  } catch (error) {
    console.error("UPDATE WORKER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        error: "A worker with this employee ID or unique value already exists.",
        details: error.keyValue || {},
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: "Failed to update worker.",
    });
  }
};

// ============================================================
// DELETE WORKER
// DELETE /api/workers/:id
// ============================================================

exports.deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);

    if (!worker) {
      return res.status(404).json({
        error: "Worker not found.",
      });
    }

    return res.json({
      message: "Worker deleted successfully.",
      worker: normalizeWorker(worker),
    });
  } catch (error) {
    console.error("DELETE WORKER ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid worker ID.",
      });
    }

    return res.status(500).json({
      error: "Failed to delete worker.",
    });
  }
};

// ============================================================
// WORKER ANALYTICS / STATS
// GET /api/workers/stats
// ============================================================

exports.getWorkerStats = async (req, res) => {
  try {
    const [
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      suspendedWorkers,
      terminatedWorkers,
      workersOnLeave,
      salaryStats,
      departmentStats,
      roleStats,
      employmentTypeStats,
      recentWorkers,
    ] = await Promise.all([
      Worker.countDocuments(),

      Worker.countDocuments({ status: "Active" }),

      Worker.countDocuments({ status: "Inactive" }),

      Worker.countDocuments({ status: "Suspended" }),

      Worker.countDocuments({ status: "Terminated" }),

      Worker.countDocuments({ status: "On Leave" }),

      Worker.aggregate([
        {
          $group: {
            _id: null,
            totalSalary: {
              $sum: { $ifNull: ["$salary", 0] },
            },
            averageSalary: {
              $avg: { $ifNull: ["$salary", 0] },
            },
            highestSalary: {
              $max: { $ifNull: ["$salary", 0] },
            },
            lowestSalary: {
              $min: { $ifNull: ["$salary", 0] },
            },
          },
        },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$department", "Unassigned"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$role", "Unassigned"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ["$employmentType", "Unspecified"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      Worker.find().sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const salary = salaryStats[0] || {
      totalSalary: 0,
      averageSalary: 0,
      highestSalary: 0,
      lowestSalary: 0,
    };

    const totalSalary = salary.totalSalary || 0;
    const averageSalary = Math.round(salary.averageSalary || 0);

    return res.json({
      totalWorkers,
      activeWorkers,
      inactiveWorkers,
      suspendedWorkers,
      terminatedWorkers,
      workersOnLeave,

      totalSalary,
      avgSalary: averageSalary,
      averageSalary,
      highestSalary: salary.highestSalary || 0,
      lowestSalary: salary.lowestSalary || 0,

      departmentStats,
      roleStats,
      employmentTypeStats,

      recentWorkers: recentWorkers.map(normalizeWorker),
    });
  } catch (error) {
    console.error("GET WORKER STATS ERROR:", error);

    return res.status(500).json({
      error: "Failed to retrieve worker statistics.",
    });
  }
};

// ============================================================
// SEARCH WORKERS
// GET /api/workers/search?search=...
// ============================================================

exports.searchWorkers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();

    if (!search) {
      return res.json([]);
    }

    // Escape regex special characters so search input is treated
    // as literal text instead of an executable regular expression.
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    const workers = await Worker.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { employeeId: searchRegex },
        { role: searchRegex },
        { department: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json(workers.map(normalizeWorker));
  } catch (error) {
    console.error("SEARCH WORKERS ERROR:", error);

    return res.status(500).json({
      error: "Failed to search workers.",
    });
  }
};
