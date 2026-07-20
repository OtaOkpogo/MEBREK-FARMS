const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getBirdHealthRecords,
  createBirdHealthRecord,
  updateBirdHealthRecord,
  deleteBirdHealthRecord,
  restoreBirdHealthRecord,
  getDeletedBirdHealthRecords,
} = require("../controllers/birdHealthController");

// All bird health routes require a logged-in user
router.use(protect);

// Staff, Manager, Super Admin can all view and create
router.get("/", getBirdHealthRecords);
router.post("/", createBirdHealthRecord);

// Manager and Super Admin only — Staff is view + create only
router.put("/:id", allowRoles("manager", "superadmin"), updateBirdHealthRecord);
router.delete(
  "/:id",
  allowRoles("manager", "superadmin"),
  deleteBirdHealthRecord,
);

// Superadmin-only: view and restore deleted records
router.get("/deleted", allowRoles("superadmin"), getDeletedBirdHealthRecords);
router.put("/:id/restore", allowRoles("superadmin"), restoreBirdHealthRecord);

module.exports = router;
