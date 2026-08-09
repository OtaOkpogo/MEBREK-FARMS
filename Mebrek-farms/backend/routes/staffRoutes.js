const express = require("express");

const router = express.Router();

// Switched from "../middleware/auth" (legacy/inconsistent with the
// rest of the codebase) to authMiddleware.js's named exports, so this
// file can actually use allowRoles like every other route file.
const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
  toggleStatus,
} = require("../controllers/staffController");

// SUPERADMIN ONLY — matches Staff Accounts' access level in App.jsx.
// Previously these routes only checked authentication (via the
// legacy auth.js), meaning any logged-in role could manage staff
// accounts directly through the API.

// GET ALL STAFF
router.get("/", protect, allowRoles("superadmin"), getStaff);

// CREATE STAFF
router.post("/", protect, allowRoles("superadmin"), createStaff);

// UPDATE STAFF
router.put("/:id", protect, allowRoles("superadmin"), updateStaff);

// ENABLE / DISABLE STAFF ACCOUNT
router.patch(
  "/:id/toggle-status",
  protect,
  allowRoles("superadmin"),
  toggleStatus,
);

// DELETE STAFF
router.delete("/:id", protect, allowRoles("superadmin"), deleteStaff);

module.exports = router;
