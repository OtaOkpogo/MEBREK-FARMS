const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const reportController = require("../controllers/reportController");
const profitLossController = require("../controllers/profitLossController");

// ============================================================
// PROFIT AND LOSS — SUPERADMIN ONLY
// Must be registered before /:type.
// ============================================================

router.get(
  "/profitloss",
  protect,
  allowRoles("superadmin"),
  profitLossController.getProfitLossReport,
);

// ============================================================
// STANDARD REPORTS — SUPERADMIN AND MANAGER
// ============================================================

router.get(
  "/:type",
  protect,
  allowRoles("superadmin", "manager"),
  reportController.getReport,
);

module.exports = router;
