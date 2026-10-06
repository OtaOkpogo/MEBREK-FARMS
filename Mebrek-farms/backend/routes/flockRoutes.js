const express = require("express");

const {
  getFlocks,
  getFlock,
  getActiveFlockByPen,
  createFlock,
  updateFlock,
  sellFlock,
  deleteFlock,
  restoreFlock,
} = require("../controllers/flockController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

/*
|--------------------------------------------------------------------------
| ALL FLOCK ROUTES REQUIRE AUTHENTICATION
|--------------------------------------------------------------------------
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| COLLECTION
|--------------------------------------------------------------------------
*/

// GET /api/flocks
router.get("/", getFlocks);

// POST /api/flocks
router.post("/", createFlock);

/*
|--------------------------------------------------------------------------
| ACTIVE FLOCK BY PEN
|--------------------------------------------------------------------------
*/

// IMPORTANT:
// This must appear BEFORE /:id
// so "pen/..." is not interpreted as an ID.
router.get("/pen/:pen/active", getActiveFlockByPen);

/*
|--------------------------------------------------------------------------
| SINGLE FLOCK
|--------------------------------------------------------------------------
*/

// GET /api/flocks/:id
router.get("/:id", getFlock);

// PUT /api/flocks/:id
router.put("/:id", updateFlock);

// PATCH /api/flocks/:id/sell
router.patch("/:id/sell", sellFlock);

// DELETE /api/flocks/:id
router.delete("/:id", deleteFlock);

// PATCH /api/flocks/:id/restore
router.patch("/:id/restore", restoreFlock);

module.exports = router;
