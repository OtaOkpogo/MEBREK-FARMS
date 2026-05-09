const router = require("express").Router();

const protect = require("../middleware/authMiddleware");

const {
  createFeed,
  getFeeds,
  updateFeed,
  deleteFeed,
} = require("../controllers/feedController");


// CREATE
router.post("/", protect, createFeed);

// READ
router.get("/", protect, getFeeds);

// UPDATE
router.put("/:id", protect, updateFeed);

// DELETE
router.delete("/:id", protect, deleteFeed);

module.exports = router;
