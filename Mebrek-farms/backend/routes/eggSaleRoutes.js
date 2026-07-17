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
} = require("../controllers/eggSaleController");

router.get("/", auth, getSales);

// Must come before "/:id" — otherwise Express treats "deleted" as an id.
router.get("/deleted", auth, allowRoles("superadmin"), getDeletedSales);

router.get("/:id", auth, getSale);

router.post("/", auth, createSale);

router.put("/:id", auth, updateSale);

router.put("/:id/restore", auth, allowRoles("superadmin"), restoreSale);

router.delete("/:id", auth, deleteSale);

module.exports = router;
