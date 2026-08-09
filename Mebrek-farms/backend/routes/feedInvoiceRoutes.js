const router = require("express").Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createInvoice,
  getInvoices,
  deleteInvoice,
  updateInvoice,
  restoreInvoice,
  getDeletedInvoices,
} = require("../controllers/feedInvoiceController");

// SUPERADMIN + MANAGER — matches Feed Invoices' access level in
// App.jsx. Previously these routes only checked authentication,
// meaning staff could hit them directly regardless of what the
// frontend hid.

router.post("/", protect, allowRoles("superadmin", "manager"), createInvoice);

router.get("/", protect, allowRoles("superadmin", "manager"), getInvoices);

router.delete(
  "/:id",
  protect,
  allowRoles("superadmin", "manager"),
  deleteInvoice,
);

router.put("/:id", protect, allowRoles("superadmin", "manager"), updateInvoice);

// SUPERADMIN ONLY — deleted-record visibility and restore follow the
// same convention as eggSaleRoutes.js / manureSaleRoutes.js.

router.put("/:id/restore", protect, allowRoles("superadmin"), restoreInvoice);

router.get("/deleted", protect, allowRoles("superadmin"), getDeletedInvoices);

module.exports = router;
