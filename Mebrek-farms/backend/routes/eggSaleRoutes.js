const express = require("express");

const router = express.Router();

const { protect: auth, allowRoles } = require("../middleware/authMiddleware");

const {
  getSales,
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

// =====================================================
// SINGLE SALE
// GET /api/egg-sales/:id
// Keep this after all named GET routes.
// =====================================================

router.get("/:id", auth, allowRoles("superadmin", "manager"), getSale);

// =====================================================
// CREATE SALE
// POST /api/egg-sales
// =====================================================

router.post("/", auth, allowRoles("superadmin", "manager"), createSale);

// =====================================================
// UPDATE SALE
// PUT /api/egg-sales/:id
// =====================================================

router.put("/:id", auth, allowRoles("superadmin", "manager"), updateSale);

// =====================================================
// RESTORE SALE — SUPERADMIN ONLY
// PUT /api/egg-sales/:id/restore
// =====================================================

router.put("/:id/restore", auth, allowRoles("superadmin"), restoreSale);

// =====================================================
// SOFT DELETE SALE
// DELETE /api/egg-sales/:id
// =====================================================

router.delete("/:id", auth, allowRoles("superadmin", "manager"), deleteSale);

module.exports = router;
