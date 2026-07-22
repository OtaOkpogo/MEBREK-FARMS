const router = require("express").Router();

const { protect } = require("../middleware/authMiddleware");

const {
  createInvoice,
  getInvoices,
  deleteInvoice,
  updateInvoice,
  restoreInvoice,
  getDeletedInvoices,
} = require("../controllers/feedInvoiceController");

router.post("/", protect, createInvoice);

router.get("/", protect, getInvoices);

router.delete("/:id", protect, deleteInvoice);

router.put("/:id", protect, updateInvoice);

router.put("/:id/restore", protect, restoreInvoice);

router.get("/deleted", protect, getDeletedInvoices);

module.exports = router;
