const router = require("express").Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createFeed,
  getFeeds,
  updateFeed,
  deleteFeed,
  adjustFeedStock,
} = require("../controllers/feedController");

// SUPERADMIN + MANAGER — Feed Inventory access

// CREATE FEED
router.post("/", protect, allowRoles("superadmin", "manager"), createFeed);

// GET FEEDS
router.get("/", protect, allowRoles("superadmin", "manager"), getFeeds);

// UPDATE FEED DETAILS
router.put("/:id", protect, allowRoles("superadmin", "manager"), updateFeed);

// ADJUST FEED STOCK
router.patch(
  "/:id/adjust-stock",
  protect,
  allowRoles("superadmin", "manager"),
  adjustFeedStock,
);

// DELETE FEED
router.delete("/:id", protect, allowRoles("superadmin", "manager"), deleteFeed);

module.exports = router;
