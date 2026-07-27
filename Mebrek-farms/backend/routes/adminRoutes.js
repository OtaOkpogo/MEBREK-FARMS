const express = require("express");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  registerAdmin,
  loginAdmin,
  getMe,
  getAdmins,
  updateAdminRole,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin,
} = require("../controllers/authController");

const router = express.Router();

// ============================================================
// AUTHENTICATION
// ============================================================

// Login
// Public
router.post("/login", loginAdmin);

// Get currently logged-in user
// Authenticated users
router.get("/me", protect, getMe);

// ============================================================
// STAFF ACCOUNT MANAGEMENT
// SUPERADMIN ONLY
// ============================================================

// Create/register a new staff account
router.post("/register", protect, allowRoles("superadmin"), registerAdmin);

// Get all staff/admin accounts
router.get("/admins", protect, allowRoles("superadmin"), getAdmins);

// Change a user's role
router.put(
  "/admins/:id/role",
  protect,
  allowRoles("superadmin"),
  updateAdminRole,
);

// Activate/deactivate a user
router.put(
  "/admins/:id/status",
  protect,
  allowRoles("superadmin"),
  toggleAdminStatus,
);

// Reset a user's password
router.put(
  "/admins/:id/reset-password",
  protect,
  allowRoles("superadmin"),
  resetAdminPassword,
);

// Delete a user
router.delete("/admins/:id", protect, allowRoles("superadmin"), deleteAdmin);

module.exports = router;
