const router = require("express").Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  createFeed,
  getFeeds,
  updateFeed,
  deleteFeed,
  adjustFeedStock,
  submitFeedChangeRequest,
  getFeedChangeRequests,
  reviewFeedChangeRequest,
} = require("../controllers/feedController");

// ============================================================
// FEED INVENTORY
// ============================================================

// Superadmin and manager can view inventory
router.get("/", protect, allowRoles("superadmin", "manager"), getFeeds);

// Superadmin and manager can create feed records
router.post("/", protect, allowRoles("superadmin", "manager"), createFeed);

// Superadmin only: directly update feed details
router.put("/:id", protect, allowRoles("superadmin"), updateFeed);

// Superadmin only: directly increase or decrease stock
router.patch(
  "/:id/adjust-stock",
  protect,
  allowRoles("superadmin"),
  adjustFeedStock,
);

// Superadmin only: delete feed records
router.delete("/:id", protect, allowRoles("superadmin"), deleteFeed);

// ============================================================
// FEED CHANGE REQUESTS
// ============================================================

// Superadmin and manager can submit requests.
// The controller should restrict managers to their own requests.
router.post(
  "/:id/change-requests",
  protect,
  allowRoles("superadmin", "manager"),
  submitFeedChangeRequest,
);

// Superadmin sees all requests; manager sees only their own.
router.get(
  "/change-requests",
  protect,
  allowRoles("superadmin", "manager"),
  getFeedChangeRequests,
);

// Superadmin only: approve or reject a request
router.patch(
  "/change-requests/:requestId",
  protect,
  allowRoles("superadmin"),
  reviewFeedChangeRequest,
);

module.exports = router;
