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

// AUTH
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/me", auth, getMe);

// STAFF MANAGEMENT
router.get("/admins", auth, getAdmins);

router.put("/admins/:id/role", auth, updateAdminRole);

router.put("/admins/:id/status", auth, toggleAdminStatus);

router.put("/admins/:id/reset-password", auth, resetAdminPassword);

router.delete("/admins/:id", auth, deleteAdmin);

module.exports = router;
