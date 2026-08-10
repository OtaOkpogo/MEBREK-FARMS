const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  getDeletedMedications,
  restoreMedication,
} = require("../controllers/medicationController");

// All medication routes require a logged-in user
router.use(protect);

// Staff, Manager, Super Admin can all view and create
router.get("/", getMedications);
router.post("/", createMedication);

// Manager and Super Admin only — Staff is view + create only, matching
// Medications.jsx's canEdit check and the identical pattern in
// birdHealthRoutes.js / vaccinationRoutes.js. Previously these two
// routes had no role restriction at all, meaning staff could update or
// delete medication records via the API even with the Edit/Delete
// buttons hidden on the frontend.
router.put("/:id", allowRoles("manager", "superadmin"), updateMedication);
router.delete("/:id", allowRoles("manager", "superadmin"), deleteMedication);

// Superadmin-only: view and restore deleted records
router.get("/deleted", allowRoles("superadmin"), getDeletedMedications);
router.put("/:id/restore", allowRoles("superadmin"), restoreMedication);

module.exports = router;
