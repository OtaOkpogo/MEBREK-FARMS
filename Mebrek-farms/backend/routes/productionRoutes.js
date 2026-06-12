const router = require("express").Router();

const {
  getProductions,
  createProduction,
} = require("../controllers/productionController");

const protect = require("../middleware/authMiddleware");

router.get("/", protect, getProductions);

router.post("/", protect, createProduction);

module.exports = router;
