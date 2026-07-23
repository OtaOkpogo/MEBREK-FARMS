const express = require("express");

const router = express.Router();

const {
  getCameras,
  createCamera,
  updateCamera,
  disableCamera,
  enableCamera,
  deleteCamera,
} = require("../controllers/cameraController");

const { protect } = require("../middleware/authMiddleware");
const { superadminOnly } = require("../middleware/superadminMiddleware");

// =========================================
// CAMERA ROUTES
// =========================================
//
// Authentication flow:
//
// 1. protect
//    Verifies JWT and attaches req.user
//
// 2. superadminOnly
//    Ensures only superadmin can access
//
// 3. Controller
//    Performs the camera operation
//
// =========================================

// Get all cameras
router.get("/", protect, superadminOnly, getCameras);

// Add camera
router.post("/", protect, superadminOnly, createCamera);

// Edit camera
router.put("/:id", protect, superadminOnly, updateCamera);

// Disable camera
router.patch("/:id/disable", protect, superadminOnly, disableCamera);

// Enable camera
router.patch("/:id/enable", protect, superadminOnly, enableCamera);

// Soft delete camera
router.delete("/:id", protect, superadminOnly, deleteCamera);

module.exports = router;
