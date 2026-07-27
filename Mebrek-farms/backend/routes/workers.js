const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createWorker,
  getWorkers,
  getWorkerStats,
  updateWorker,
  deleteWorker,
} = require("../controllers/workerController");

// ============================================================
// WORKER MANAGEMENT
// SUPERADMIN ONLY
// ============================================================

// Create worker
router.post("/", protect, allowRoles("superadmin"), createWorker);

// Get all workers
router.get("/", protect, allowRoles("superadmin"), getWorkers);

// Get worker statistics
router.get("/stats", protect, allowRoles("superadmin"), getWorkerStats);

// Update worker
router.put("/:id", protect, allowRoles("superadmin"), updateWorker);

// Delete worker
router.delete("/:id", protect, allowRoles("superadmin"), deleteWorker);

module.exports = router;
