const Worker = require("../models/Worker");

// =========================
// Create Worker
// =========================
exports.createWorker = async (req, res) => {
  try {
    const worker = new Worker(req.body);
    await worker.save();
    res.status(201).json(worker);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    // Total workers
    const totalWorkers = await Worker.countDocuments();

    // Salary stats
    const salaryStats = await Worker.aggregate([
      {
        $group: {
          _id: null,
          totalSalary: { $sum: "$salary" },
          avgSalary: { $avg: "$salary" },
        },
      },
    ]);

    // Role distribution
    const roleStats = await Worker.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Recent workers
    const recentWorkers = await Worker.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      totalWorkers,
      totalSalary: salaryStats[0]?.totalSalary || 0,
      avgSalary: salaryStats[0]?.avgSalary || 0,
      roleStats,
      recentWorkers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
