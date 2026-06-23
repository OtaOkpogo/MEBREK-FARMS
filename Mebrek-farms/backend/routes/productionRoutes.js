const router = require("express").Router();

const {
  getProductions,
  createProduction,
} = require("../controllers/productionController");

const protect = require("../middleware/authMiddleware");

router.get("/", protect, getProductions);

router.post(
  "/",
  protect,
  (req, res, next) => {
    console.log("POST ROUTE HIT");
    next();
  },
  createProduction,
);

module.exports = router;
