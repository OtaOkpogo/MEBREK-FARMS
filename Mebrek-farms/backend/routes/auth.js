const express = require("express");

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  registerAdmin,
  loginAdmin,
  getMe,
  getAdmins,
  updateAdmin,
  updateAdminRole,
  toggleAdminStatus,
  resetAdminPassword,
  deleteAdmin,
} = require("../controllers/authController");

const router = express.Router();

// ============================================================
// AUTH
// ============================================================

// REGISTER ADMIN — SUPERADMIN ONLY
router.post("/register", protect, allowRoles("superadmin"), registerAdmin);

// LOGIN
router.post("/login", loginAdmin);

// CURRENT LOGGED-IN USER
router.get("/me", protect, getMe);

// ============================================================
// STAFF / ADMIN ACCOUNT MANAGEMENT
// ============================================================

// GET ALL ADMINS / STAFF
// SUPERADMIN ONLY
router.get("/admins", protect, allowRoles("superadmin"), getAdmins);

// UPDATE ADMIN DETAILS
// Updates name and email
// SUPERADMIN ONLY
router.put("/admins/:id", protect, allowRoles("superadmin"), updateAdmin);

// UPDATE ADMIN ROLE
// SUPERADMIN ONLY
router.put(
  "/admins/:id/role",
  protect,
  allowRoles("superadmin"),
  updateAdminRole,
);

// ACTIVATE / DISABLE ACCOUNT
// SUPERADMIN ONLY
router.put(
  "/admins/:id/status",
  protect,
  allowRoles("superadmin"),
  toggleAdminStatus,
);

// RESET PASSWORD
// SUPERADMIN ONLY
router.put(
  "/admins/:id/password",
  protect,
  allowRoles("superadmin"),
  resetAdminPassword,
);

// DELETE ACCOUNT
// SUPERADMIN ONLY
router.delete("/admins/:id", protect, allowRoles("superadmin"), deleteAdmin);

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;
