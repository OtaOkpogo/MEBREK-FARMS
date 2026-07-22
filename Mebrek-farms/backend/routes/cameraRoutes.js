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

const protect = require("../middleware/authMiddleware");

// =========================================
// CAMERA ROUTES
// =========================================

// Get all cameras
router.get("/", protect, getCameras);

// Add camera
router.post("/", protect, createCamera);

// Edit camera
router.put("/:id", protect, updateCamera);

// Disable camera
router.patch("/:id/disable", protect, disableCamera);

// Enable camera
router.patch("/:id/enable", protect, enableCamera);

// Soft delete camera
router.delete("/:id", protect, deleteCamera);

module.exports = router;
