const express = require("express");

const {
  getFlocks,
  getFlock,
  getActiveFlockByPen,
  createFlock,
  updateFlock,
  createFlockTransfer,
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

/*
|--------------------------------------------------------------------------
| COLLECTION ROUTES
|--------------------------------------------------------------------------
*/

router.get("/", getFlocks);
router.post("/", createFlock);

/*
|--------------------------------------------------------------------------
| PEN ROUTES
|--------------------------------------------------------------------------
| Keep this before /:id routes.
|--------------------------------------------------------------------------
*/

router.get("/pen/:pen/active", getActiveFlockByPen);

/*
|--------------------------------------------------------------------------
| FLOCK-SPECIFIC ROUTES
|--------------------------------------------------------------------------
*/

router.get("/:id/allocations", getFlockAllocations);

router.get("/:id/transfers", getFlockTransfers);

router.post("/:id/transfers", createFlockTransfer);

router.get("/:id/population-history", getFlockPopulationHistory);

router.post("/:id/population-adjustments", createFlockPopulationAdjustment);

/*
|--------------------------------------------------------------------------
| FLOCK CRUD AND LIFECYCLE
|--------------------------------------------------------------------------
*/

router.get("/:id", getFlock);

router.put("/:id", updateFlock);

router.patch("/:id/sell", sellFlock);

router.delete("/:id", deleteFlock);

router.patch("/:id/restore", restoreFlock);

module.exports = router;
