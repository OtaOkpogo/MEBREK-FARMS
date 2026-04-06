const express = require("express");
const {
  createOrder,
  getOrders
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);   // submit order
router.get("/", getOrders);      // admin fetch

module.exports = router;
