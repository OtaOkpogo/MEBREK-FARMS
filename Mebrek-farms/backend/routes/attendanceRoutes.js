const express = require("express");

const router = express.Router();

const {
  getAttendance,
  createAttendance,
  deleteAttendance,
  getDeletedAttendance,
  restoreAttendance,
} = require("../controllers/attendanceController");

const {
  protect: authMiddleware,
  allowRoles,
} = require("../middleware/authMiddleware");

// GET ALL — all roles

router.get("/", authMiddleware, getAttendance);

// CREATE — all roles

router.post("/", authMiddleware, createAttendance);

// DELETE (soft delete) — manager + superadmin only, matching
// Attendance.jsx's canDelete check. Previously had no role
// restriction at all.

router.delete(
  "/:id",
  authMiddleware,
  allowRoles("manager", "superadmin"),
  deleteAttendance,
);

// Superadmin-only: view and restore deleted records

router.get(
  "/deleted",
  authMiddleware,
  allowRoles("superadmin"),
  getDeletedAttendance,
);

router.put(
  "/:id/restore",
  authMiddleware,
  allowRoles("superadmin"),
  restoreAttendance,
);

module.exports = router;
