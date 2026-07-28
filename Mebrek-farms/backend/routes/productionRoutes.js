const router = require("express").Router();

const {
  getProductions,
  getProduction,
  createProduction,
  updateProduction,
  deleteProduction,
} = require("../controllers/productionController");

const { protect } = require("../middleware/authMiddleware");

// Get all production record
router.get("/", protect, getProductions);

// Get single production record (used to prefill the edit form)
router.get("/:id", protect, getProduction);

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

// Update production record
router.put("/:id", protect, updateProduction);

// Soft delete production record
router.delete("/:id", protect, deleteProduction);

module.exports = router;
