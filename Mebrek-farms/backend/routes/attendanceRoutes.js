const express = require("express");

const router = express.Router();

const {
  getAttendance,
  createAttendance,
  deleteAttendance,
} = require(
  "../controllers/attendanceController"
);

const authMiddleware = require(
  "../middleware/authMiddleware"
);


// GET ALL

router.get(
  "/",
  authMiddleware,
  getAttendance
);


// CREATE

router.post(
  "/",
  authMiddleware,
  createAttendance
);


// DELETE

router.delete(
  "/:id",
  authMiddleware,
  deleteAttendance
);

module.exports = router;
