const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
  createOrder,
  getOrders,
  updateOrderStatus,
} = require("../controllers/orderController");

// PUBLIC — the website's order form hits this with no auth
router.post("/", createOrder);

// PROTECTED — any logged-in admin account (staff, manager, superadmin)
router.get("/", protect, getOrders);

router.put("/:id/status", protect, updateOrderStatus);

module.exports = router;
