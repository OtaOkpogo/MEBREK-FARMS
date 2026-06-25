const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
  toggleStatus,
} = require("../controllers/staffController");

// GET ALL STAFF
router.get("/", auth, getStaff);

// CREATE STAFF
router.post("/", auth, createStaff);

// UPDATE STAFF
router.put("/:id", auth, updateStaff);

// ENABLE / DISABLE STAFF ACCOUNT
router.patch("/:id/toggle-status", auth, toggleStatus);

// DELETE STAFF
router.delete("/:id", auth, deleteStaff);

module.exports = router;
