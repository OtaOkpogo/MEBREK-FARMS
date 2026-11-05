const express = require("express");

const router = express.Router();

const {
  getLoginActivities,
} = require("../controllers/loginActivityController");

const {
  protect,
  allowRoles,
} = require("../middleware/authMiddleware");

// Superadmin only
router.get(
  "/",
  protect,
  allowRoles("superadmin"),
  getLoginActivities,
);

module.exports = router;
