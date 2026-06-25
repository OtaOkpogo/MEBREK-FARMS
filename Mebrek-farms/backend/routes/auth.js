const express = require("express");

const auth = require("../middleware/auth");

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
router.get("/me", auth, getMe);

// ================= STAFF MANAGEMENT =================

// GET ALL ADMINS / STAFF
router.get("/admins", auth, getAdmins);

// UPDATE ROLE
router.put("/admins/:id/role", auth, updateAdminRole);

// ACTIVATE / DISABLE ACCOUNT
router.put("/admins/:id/status", auth, toggleAdminStatus);

// RESET PASSWORD
router.put("/admins/:id/password", auth, resetAdminPassword);

// DELETE ACCOUNT
router.delete("/admins/:id", auth, deleteAdmin);

module.exports = router;
