const express = require("express");
const router = express.Router();

const { globalSearch } = require("../controllers/searchController");
const { protect } = require("../middleware/authMiddleware");

// All authenticated users can use global search
router.get("/", protect, globalSearch);

module.exports = router;
