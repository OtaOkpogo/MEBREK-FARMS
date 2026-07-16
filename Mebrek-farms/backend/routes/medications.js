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

router.get("/", getMedications);
router.post("/", createMedication);
router.put("/:id", updateMedication);
router.delete("/:id", deleteMedication);

// Superadmin-only: view and restore deleted records
router.get("/deleted", allowRoles("superadmin"), getDeletedMedications);
router.put("/:id/restore", allowRoles("superadmin"), restoreMedication);

module.exports = router;
