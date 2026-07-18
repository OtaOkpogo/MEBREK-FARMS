const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
  createVaccination,
  getVaccinations,
  updateVaccination,
  deleteVaccination,
  restoreVaccination,
} = require("../controllers/vaccinationController");

// Small inline role-gate, kept local to this file so it doesn't depend on
// anything not already confirmed to exist in authMiddleware.js. If you
// already have an equivalent (e.g. a shared `requireRole` helper used
// elsewhere), swap this out for that instead to avoid duplicating logic.
const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action",
      });
    }
    next();
  };

// PROTECTED — Staff, Manager, Super Admin can all create records
router.post("/", protect, createVaccination);

// PROTECTED — Staff, Manager, Super Admin can all view records
// (Staff/Manager get isDeleted:false only; superadmin sees everything —
// handled inside the controller, not here)
router.get("/", protect, getVaccinations);

// PROTECTED — Manager and Super Admin only (Staff is create + read only)
router.put(
  "/:id",
  protect,
  requireRole("manager", "superadmin"),
  updateVaccination,
);

router.delete(
  "/:id",
  protect,
  requireRole("manager", "superadmin"),
  deleteVaccination,
);

// PROTECTED — Super Admin only, matching the Restore pattern in
// Room Inventory/Feed
router.patch(
  "/:id/restore",
  protect,
  requireRole("superadmin"),
  restoreVaccination,
);

module.exports = router;
