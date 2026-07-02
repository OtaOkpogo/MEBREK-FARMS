const router = require("express").Router();

const {
  getProductions,
  createProduction,
  deleteProduction,
} = require("../controllers/productionController");

const protect = require("../middleware/authMiddleware");

// Get all production record
router.get("/", protect, getProductions);

// Create production record
router.post(
  "/",
  protect,
  (req, res, next) => {
    console.log("POST ROUTE HIT");
    next();
  },
  createProduction,
);

// Soft delete production record
router.delete("/:id", protect, deleteProduction);

module.exports = router;
