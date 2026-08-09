const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

// Generate Reports — Super Admin & Manager only (Workers/"staff" are blocked)
router.get(
  "/:type",
  protect,
  allowRoles("superadmin", "manager"),
  reportController.getReport,
);

module.exports = router;
