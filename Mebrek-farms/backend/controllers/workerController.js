const Worker = require("../models/Worker");

// =========================
// Create Worker
// =========================
exports.createWorker = async (req, res) => {
  try {
    const worker = await Worker.create(req.body);

    res.status(201).json(worker);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================
// Get All Workers
// =========================
exports.getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find().sort({ createdAt: -1 });
    res.json(workers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Update Worker
// =========================
exports.updateWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    res.json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Delete Worker
// =========================
exports.deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);

    if (!worker) {
      return res.status(404).json({ error: "Worker not found" });
    }

    res.json({ message: "Worker deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Worker Analytics
// =========================
exports.getWorkerStats = async (req, res) => {
  try {
    const totalWorkers = await Worker.countDocuments();

    const activeWorkers = await Worker.countDocuments({
      status: "Active",
    });

    const inactiveWorkers = await Worker.countDocuments({
      status: "Inactive",
    });

    const salaryStats = await Worker.aggregate([
      {
        $group: {
          _id: null,
          totalSalary: { $sum: "$salary" },
          averageSalary: { $avg: "$salary" },
          highestSalary: { $max: "$salary" },
          lowestSalary: { $min: "$salary" },
        },
      },
    ]);

    const departmentStats = await Worker.aggregate([
      {
        $group: {
          _id: "$department",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    const roleStats = await Worker.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ]);

    const recentWorkers = await Worker.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      totalWorkers,
      activeWorkers,
      inactiveWorkers,

      totalSalary: salaryStats[0]?.totalSalary || 0,

      averageSalary: Math.round(salaryStats[0]?.averageSalary || 0),

      highestSalary: salaryStats[0]?.highestSalary || 0,

      lowestSalary: salaryStats[0]?.lowestSalary || 0,

      departmentStats,
      roleStats,
      recentWorkers,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};
