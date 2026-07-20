const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

// Generate Reports
router.get("/:type", protect, reportController.getReport);

module.exports = router;
