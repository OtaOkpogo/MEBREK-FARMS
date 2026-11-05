
const express = require("express");

const router = express.Router();

const {
  getAuditLogs,
} = require("../controllers/auditLogController");

const {
  protect,
  allowRoles,
} = require("../middleware/authMiddleware");

// ============================================================
// SUPERADMIN-ONLY AUDIT LOG ACCESS
// ============================================================

router.get(
  "/",
  protect,
  allowRoles("superadmin"),
  getAuditLogs
);

module.exports = router;

