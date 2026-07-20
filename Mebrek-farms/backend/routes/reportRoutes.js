const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getProductionReport,
  getEggSalesReport,
  getFeedReport,
  getMortalityReport,
  getVaccinationReport,
  getWarehouseReport,
  getStaffReport,
} = require("../controllers/reportController");

// All report routes require login, and are Manager/Super Admin only —
// Worker/Staff has no access per the reports permissions table.
router.use(protect, allowRoles("manager", "superadmin"));

router.get("/production", getProductionReport);
router.get("/egg-sales", getEggSalesReport);
router.get("/feed", getFeedReport);
router.get("/mortality", getMortalityReport);
router.get("/vaccination", getVaccinationReport);
router.get("/warehouse", getWarehouseReport);
router.get("/staff", getStaffReport);

module.exports = router;
