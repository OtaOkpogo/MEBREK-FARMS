const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");

const {
  createOrder,
  getOrders,
  createManualBooking,
  updateOrderStatus,
  updateBookingDetails,
  deleteOrder,
} = require("../controllers/orderController");

// PUBLIC — keep the public website's existing unauthenticated endpoint.
router.post("/", createOrder);

// PROTECTED — admin routes.
router.get("/", protect, getOrders);
router.post("/booking", protect, createManualBooking);
router.put("/:id/status", protect, updateOrderStatus);
router.put("/:id/booking-details", protect, updateBookingDetails);
router.delete("/:id", protect, deleteOrder);

module.exports = router;
