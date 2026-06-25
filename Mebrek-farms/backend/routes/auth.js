const express = require("express");

const auth = require("../middleware/auth");

const {
  registerAdmin,
  loginAdmin,
  getMe,
} = require("../controllers/authController");

const router = express.Router();

// REGISTER
router.post("/register", registerAdmin);

// LOGIN
router.post("/login", loginAdmin);

// CURRENT LOGGED-IN USER
router.get("/me", auth, getMe);

module.exports = router;
