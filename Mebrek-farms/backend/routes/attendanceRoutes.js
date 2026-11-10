const express = require("express");
const router = express.Router();

const {
  getAttendance,
  getAttendanceWorkers,
  getMyAttendance,
  checkIn,
  checkOut,
  createAttendance,
  updateAttendance,
  deleteAttendance,
  getDeletedAttendance,
  restoreAttendance,
} = require("../controllers/attendanceController");

const { protect, allowRoles } = require("../middleware/authMiddleware");

// All attendance routes require authentication.
router.use(protect);

// ============================================================
// PERSONAL ATTENDANCE
// Manager and staff can access only their own records.
// ============================================================

router.get("/mine", allowRoles("manager", "staff"), getMyAttendance);

router.post("/check-in", allowRoles("manager", "staff"), checkIn);

router.patch("/check-out", allowRoles("manager", "staff"), checkOut);

// ============================================================
// ATTENDANCE ADMINISTRATION
// Superadmin and manager only.
// ============================================================

router.get("/", allowRoles("superadmin", "manager"), getAttendance);

router.get(
  "/workers",
  allowRoles("superadmin", "manager"),
  getAttendanceWorkers,
);

router.post("/", allowRoles("superadmin", "manager"), createAttendance);

router.put("/:id", allowRoles("superadmin", "manager"), updateAttendance);

router.delete("/:id", allowRoles("superadmin", "manager"), deleteAttendance);

// ============================================================
// DELETED ATTENDANCE
// Superadmin only.
// ============================================================

router.get("/deleted", allowRoles("superadmin"), getDeletedAttendance);

router.put("/:id/restore", allowRoles("superadmin"), restoreAttendance);

module.exports = router;
