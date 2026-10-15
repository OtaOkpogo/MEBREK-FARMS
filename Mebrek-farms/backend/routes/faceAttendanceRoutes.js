
const express = require("express");
const router = express.Router();

const {
  enrollFace,
  removeFace,
  recognizeFace,
} = require("../controllers/faceAttendanceController");

const {
  protect,
  allowRoles,
} = require("../middleware/authMiddleware");

// Only superadmins may enroll or remove facial templates.
router.post(
  "/enroll",
  protect,
  allowRoles("superadmin"),
  enrollFace,
);

router.delete(
  "/enroll/:workerId",
  protect,
  allowRoles("superadmin"),
  removeFace,
);

// Any authenticated account may use the attendance camera.
// Recognition still needs production-grade liveness protection.
router.post(
  "/recognize",
  protect,
  recognizeFace,
);

module.exports = router;

