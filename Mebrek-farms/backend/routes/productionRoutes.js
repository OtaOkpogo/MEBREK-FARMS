const router = require("express").Router();

const {
  getProduction,
  createProduction,
} = require("../controllers/productionController");

const protect = require("../middleware/authMiddleware");

router.get("/", protect, getProduction);

router.post("/", protect, createProduction);

module.exports = router;
