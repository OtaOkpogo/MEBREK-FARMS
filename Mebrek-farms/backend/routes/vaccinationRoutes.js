const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  getDeletedVaccinations,
  restoreVaccination,
} = require("../controllers/vaccinationController");

// All vaccination routes require a logged-in user
router.use(protect);

router.get("/", getVaccinations);
router.post("/", createVaccination);
router.put("/:id", updateVaccination);
router.delete("/:id", deleteVaccination);

// Superadmin-only: view and restore deleted records
router.get("/deleted", allowRoles("superadmin"), getDeletedVaccinations);
router.put("/:id/restore", allowRoles("superadmin"), restoreVaccination);

module.exports = router;
