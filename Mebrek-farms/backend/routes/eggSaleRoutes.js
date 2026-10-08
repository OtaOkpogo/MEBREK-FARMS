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
} = require("../controllers/eggSaleController");

// =====================================================
// EGG SALES ACCESS
// =====================================================
// Egg Sales is available to:
// - superadmin
// - manager
//
// Staff are blocked at the backend even if the frontend
// happens to hide the page.
// =====================================================

router.get("/", auth, allowRoles("superadmin", "manager"), getSales);

// =====================================================
// DELETED SALES
// =====================================================
// Superadmin only.
// IMPORTANT: This must come before "/:id".
// =====================================================

router.get("/deleted", auth, allowRoles("superadmin"), getDeletedSales);

// =====================================================
// CUSTOMER PURCHASE HISTORY
// =====================================================
// Returns all active Egg Sales belonging to a specific
// Customer, together with purchase summary information.
//
// IMPORTANT: This MUST come before "/:id".
// Otherwise Express may interpret "customer" as an id.
// =====================================================

router.get(
  "/customer/:customerId",
  auth,
  allowRoles("superadmin", "manager"),
  getSalesByCustomer,
);

// =====================================================
// SINGLE SALE
// =====================================================

router.get("/:id", auth, allowRoles("superadmin", "manager"), getSale);

// =====================================================
// CREATE SALE
// =====================================================

router.post("/", auth, allowRoles("superadmin", "manager"), createSale);

// =====================================================
// UPDATE SALE
// =====================================================

router.put("/:id", auth, allowRoles("superadmin", "manager"), updateSale);

// =====================================================
// RESTORE SALE
// =====================================================
// Superadmin only.
// =====================================================

router.put("/:id/restore", auth, allowRoles("superadmin"), restoreSale);

// =====================================================
// SOFT DELETE SALE
// =====================================================

router.delete("/:id", auth, allowRoles("superadmin", "manager"), deleteSale);

module.exports = router;
