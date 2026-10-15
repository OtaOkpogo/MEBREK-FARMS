const express = require("express");
const router = express.Router();

const {
  getAttendance,
  getAttendanceWorkers,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getDeletedAttendance,
  restoreAttendance,
} = require("../controllers/attendanceController");

const {
  protect: authMiddleware,
  allowRoles,
} = require("../middleware/authMiddleware");

// All authenticated roles can view active attendance.
// Superadmin sees deleted records inline too.
router.get("/", authMiddleware, getAttendance);

// Registered active workers for attendance entry.
router.get("/workers", authMiddleware, getAttendanceWorkers);

// All authenticated roles can record attendance.
router.post("/", authMiddleware, createAttendance);

// All authenticated roles can update attendance/check-out.
router.put("/:id", authMiddleware, updateAttendance);

// Manager and superadmin can soft-delete.
router.delete(
  "/:id",
  authMiddleware,
  allowRoles("manager", "superadmin"),
  deleteAttendance,
);

// Superadmin-only deleted-record access.
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
