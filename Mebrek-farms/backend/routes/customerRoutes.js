const express = require("express");

const {
  createCustomer,
  getCustomers,
  getCustomerById,
  searchCustomers,
  updateCustomer,
  deleteCustomer,
} = require("../controllers/customerController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// All customer routes require authentication
router.use(protect);

// Search must come before /:id
router.get("/search", searchCustomers);

router.get("/", getCustomers);

router.get("/:id", getCustomerById);

router.post("/", createCustomer);

router.put("/:id", updateCustomer);

router.delete("/:id", deleteCustomer);

module.exports = router;
