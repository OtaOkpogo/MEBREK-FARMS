const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");
const { exportDatabase } = require("../controllers/backupController");

router.get("/export", protect, allowRoles("superadmin"), exportDatabase);

module.exports = router;
