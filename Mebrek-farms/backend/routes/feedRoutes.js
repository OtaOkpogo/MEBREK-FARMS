const router = require("express").Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createFeed,
  getFeeds,
  updateFeed,
  deleteFeed,
} = require("../controllers/feedController");

// SUPERADMIN + MANAGER — matches the Feed Inventory access level in
// App.jsx. Previously these routes only checked authentication (any
// logged-in role), meaning staff could hit /api/feeds directly and
// create/edit/delete inventory regardless of what the frontend hid.

// CREATE
router.post("/", protect, allowRoles("superadmin", "manager"), createFeed);

// READ
router.get("/", protect, allowRoles("superadmin", "manager"), getFeeds);

// UPDATE
router.put("/:id", protect, allowRoles("superadmin", "manager"), updateFeed);

// DELETE
router.delete("/:id", protect, allowRoles("superadmin", "manager"), deleteFeed);

module.exports = router;
