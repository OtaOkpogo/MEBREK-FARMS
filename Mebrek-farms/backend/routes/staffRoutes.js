const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

router.get("/", auth, getStaff);

router.post("/", auth, createStaff);

router.put("/:id", auth, updateStaff);

router.delete("/:id", auth, deleteStaff);

module.exports = router;
