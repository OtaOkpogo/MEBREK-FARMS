const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const {
  createOrder,
  getOrders
} = require("../controllers/orderController");

// PUBLIC
router.post("/", createOrder);

// PROTECTED
router.get("/", auth, getOrders);

module.exports = router;
