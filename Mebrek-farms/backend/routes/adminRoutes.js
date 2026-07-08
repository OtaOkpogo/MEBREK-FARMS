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

// AUTH
router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/me", protect, getMe);

// STAFF MANAGEMENT
router.get("/admins", protect, getAdmins);

router.put("/admins/:id/role", protect, updateAdminRole);

router.put("/admins/:id/status", protect, toggleAdminStatus);

router.put("/admins/:id/reset-password", protect, resetAdminPassword);

router.delete("/admins/:id", protect, deleteAdmin);

module.exports = router;
