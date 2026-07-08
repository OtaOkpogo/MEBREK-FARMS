const express = require("express");

const { protect } = require("../middleware/authMiddleware");

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

// REGISTER ADMIN
router.post("/register", registerAdmin);

// LOGIN
router.post("/login", loginAdmin);

// CURRENT LOGGED-IN USER
router.get("/me", protect, getMe);

// ================= STAFF MANAGEMENT =================

// GET ALL ADMINS / STAFF
router.get("/admins", protect, getAdmins);

// UPDATE ROLE
router.put("/admins/:id/role", protect, updateAdminRole);

// ACTIVATE / DISABLE ACCOUNT
router.put("/admins/:id/status", protect, toggleAdminStatus);

// RESET PASSWORD
router.put("/admins/:id/password", protect, resetAdminPassword);

// DELETE ACCOUNT
router.delete("/admins/:id", protect, deleteAdmin);

module.exports = router;
