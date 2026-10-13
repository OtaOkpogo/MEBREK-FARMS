const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const controller = require("../controllers/saleAccessRequestController");

// All sale-access request routes require authentication.
router.use(protect);

// Create a request.
router.post("/", allowRoles("manager", "superadmin"), controller.createRequest);

// List requests.
router.get("/", allowRoles("manager", "superadmin"), controller.getRequests);

// Superadmin reviews pending requests.
router.put("/:id/review", allowRoles("superadmin"), controller.reviewRequest);

// Managers mark their own reviewed requests as viewed.
router.patch("/:id/viewed", allowRoles("manager"), controller.markViewed);

// Delete requests:
// - Managers: their own pending requests only.
// - Superadmins: requests in any status.
router.delete(
  "/:id",
  allowRoles("manager", "superadmin"),
  controller.deleteRequest,
);

module.exports = router;
