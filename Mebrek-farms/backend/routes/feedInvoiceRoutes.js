const router = require("express").Router();

const protect = require("../middleware/authMiddleware");

const {
  createInvoice,
  getInvoices,
  deleteInvoice,
} = require("../controllers/feedInvoiceController");

router.post("/", protect, createInvoice);

router.get("/", protect, getInvoices);

router.delete("/:id", protect, deleteInvoice);

module.exports = router;
