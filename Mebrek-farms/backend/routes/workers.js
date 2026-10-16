const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createWorker,
  getWorkers,
  getWorkerById,
  getWorkerStats,
  updateWorker,
  deleteWorker,
  searchWorkers,
} = require("../controllers/workerController");

// All worker-management routes are restricted to superadmin.

// CREATE WORKER
router.post("/", protect, allowRoles("superadmin"), createWorker);

// SEARCH WORKERS
router.get("/search", protect, allowRoles("superadmin"), searchWorkers);

// WORKER STATISTICS
router.get("/stats", protect, allowRoles("superadmin"), getWorkerStats);

// GET ALL WORKERS
router.get("/", protect, allowRoles("superadmin"), getWorkers);

// GET ONE WORKER
router.get("/:id", protect, allowRoles("superadmin"), getWorkerById);

// UPDATE WORKER
router.put("/:id", protect, allowRoles("superadmin"), updateWorker);

// DELETE WORKER
router.delete("/:id", protect, allowRoles("superadmin"), deleteWorker);

module.exports = router;
