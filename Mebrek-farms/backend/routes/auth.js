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

// ================= AUTH =================

// REGISTER ADMIN — SUPERADMIN ONLY. This was previously public with
// no auth middleware at all, meaning anyone on the internet could
// create their own account — including a superadmin account, if the
// role field wasn't otherwise restricted server-side. Confirmed no
// public signup flow depends on this endpoint before locking it down.
router.post("/register", protect, allowRoles("superadmin"), registerAdmin);

// LOGIN
router.post("/login", loginAdmin);

// CURRENT LOGGED-IN USER
router.get("/me", protect, getMe);

// ================= STAFF MANAGEMENT =================
// SUPERADMIN ONLY — matches StaffAccounts.jsx's access level. These
// five routes previously only checked authentication, meaning any
// logged-in role (including staff) could list all admin accounts,
// change anyone's role (including self-promoting to superadmin),
// disable/enable accounts, reset passwords, or delete accounts.

// GET ALL ADMINS / STAFF
router.get("/admins", protect, allowRoles("superadmin"), getAdmins);

// UPDATE ROLE
router.put(
  "/admins/:id/role",
  protect,
  allowRoles("superadmin"),
  updateAdminRole,
);

// ACTIVATE / DISABLE ACCOUNT
router.put(
  "/admins/:id/status",
  protect,
  allowRoles("superadmin"),
  toggleAdminStatus,
);

// RESET PASSWORD
router.put(
  "/admins/:id/password",
  protect,
  allowRoles("superadmin"),
  resetAdminPassword,
);

// DELETE ACCOUNT
router.delete("/admins/:id", protect, allowRoles("superadmin"), deleteAdmin);

module.exports = router;
