const express = require("express");

const {
  getFlocks,
  getFlock,
  getActiveFlockByPen,
  getPenOccupancySummary,
  createFlock,
  updateFlock,
  createFlockTransfer,
  cancelFlockTransfer,
  getFlockAllocations,
  getFlockTransfers,
  getFlockPopulationHistory,
  createFlockPopulationAdjustment,
  sellFlock,
  deleteFlock,
  restoreFlock,
} = require("../controllers/flockController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// Flock listing and creation
router.get("/", getFlocks);
router.post("/", createFlock);

// Pen operations
router.get("/pen/:pen/active", getActiveFlockByPen);
router.get("/pen-occupancy", getPenOccupancySummary);

// Allocation operations
router.get("/:id/allocations", getFlockAllocations);

// Transfer operations
router.get("/:id/transfers", getFlockTransfers);
router.post("/:id/transfers", createFlockTransfer);
router.patch("/:id/transfers/:transferId/cancel", cancelFlockTransfer);

// Population operations
router.get("/:id/population-history", getFlockPopulationHistory);
router.post("/:id/population-adjustments", createFlockPopulationAdjustment);

// Individual flock operations
router.get("/:id", getFlock);
router.put("/:id", updateFlock);
router.patch("/:id/sell", sellFlock);
router.delete("/:id", deleteFlock);
router.patch("/:id/restore", restoreFlock);

module.exports = router;
