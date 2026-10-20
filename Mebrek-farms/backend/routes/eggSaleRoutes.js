const express = require("express");

const router = express.Router();

const { protect: auth, allowRoles } = require("../middleware/authMiddleware");

const {
  getSales,
  getSalesSummary,
  getSale,
  createSale,
  updateSale,
  deleteSale,
  getDeletedSales,
  restoreSale,
  getSalesByCustomer,
  getOutstandingCustomers,
} = require("../controllers/eggSaleController");

// =====================================================
// EGG SALES LIST
// GET /api/egg-sales
// =====================================================
router.get("/", auth, allowRoles("superadmin", "manager"), getSales);

// =====================================================
// PERIOD SALES SUMMARY (aggregate data only)
// GET /api/egg-sales/summary?period=daily|weekly|monthly|yearly&date=YYYY-MM-DD
// Keep this named route before /:id.
// =====================================================
router.get("/summary", auth, allowRoles("superadmin"), getSalesSummary);

// =====================================================
// OUTSTANDING CUSTOMERS
// GET /api/egg-sales/outstanding
// =====================================================
router.get(
  "/outstanding",
  auth,
  allowRoles("superadmin", "manager"),
  getOutstandingCustomers,
);

// =====================================================
// DELETED SALES — SUPERADMIN ONLY
// GET /api/egg-sales/deleted
// =====================================================
router.get("/deleted", auth, allowRoles("superadmin"), getDeletedSales);

// =====================================================
// CUSTOMER PURCHASE HISTORY
// GET /api/egg-sales/customer/:customerId
// =====================================================
router.get(
  "/customer/:customerId",
  auth,
  allowRoles("superadmin", "manager"),
  getSalesByCustomer,
);

// Keep dynamic ID routes after all named GET routes.
router.get("/:id", auth, allowRoles("superadmin", "manager"), getSale);
router.post("/", auth, allowRoles("superadmin", "manager"), createSale);
router.put("/:id", auth, allowRoles("superadmin", "manager"), updateSale);
router.put("/:id/restore", auth, allowRoles("superadmin"), restoreSale);
router.delete("/:id", auth, allowRoles("superadmin", "manager"), deleteSale);

module.exports = router;
