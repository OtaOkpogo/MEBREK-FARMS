const express = require("express");

const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
  getSales,
  getSale,
  createSale,
  updateSale,
  deleteSale,
} = require("../controllers/eggSaleController");

router.get("/", auth, getSales);

router.get("/:id", auth, getSale);

router.post("/", auth, createSale);

router.put("/:id", auth, updateSale);

router.delete("/:id", auth, deleteSale);

module.exports = router;
