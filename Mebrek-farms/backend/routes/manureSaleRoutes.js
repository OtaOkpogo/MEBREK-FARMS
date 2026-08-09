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
} = require("../controllers/manureSaleController");

// SUPERADMIN + MANAGER — matches Manure Sales' access level in
// App.jsx. These main routes previously only checked authentication,
// meaning staff could hit them directly regardless of what the
// frontend hid. Deleted-record visibility and restore stay
// superadmin-only, unchanged.

router.get("/", auth, allowRoles("superadmin", "manager"), getSales);

// Must come before "/:id" — otherwise Express treats "deleted" as an id.
router.get("/deleted", auth, allowRoles("superadmin"), getDeletedSales);

router.get("/:id", auth, allowRoles("superadmin", "manager"), getSale);

router.post("/", auth, allowRoles("superadmin", "manager"), createSale);

router.put("/:id", auth, allowRoles("superadmin", "manager"), updateSale);

router.put("/:id/restore", auth, allowRoles("superadmin"), restoreSale);

router.delete("/:id", auth, allowRoles("superadmin", "manager"), deleteSale);

module.exports = router;
