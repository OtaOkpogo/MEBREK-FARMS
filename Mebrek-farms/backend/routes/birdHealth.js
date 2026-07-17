const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getBirdHealthRecords,
  createBirdHealthRecord,
  updateBirdHealthRecord,
  deleteBirdHealthRecord,
  getDeletedBirdHealthRecords,
  restoreBirdHealthRecord,
} = require("../controllers/birdHealthController");

// All bird health routes require a logged-in user
router.use(protect);

router.get("/", getBirdHealthRecords);
router.post("/", createBirdHealthRecord);
router.put("/:id", updateBirdHealthRecord);
router.delete("/:id", deleteBirdHealthRecord);

// Superadmin-only: view and restore deleted records
router.get("/deleted", allowRoles("superadmin"), getDeletedBirdHealthRecords);
router.put("/:id/restore", allowRoles("superadmin"), restoreBirdHealthRecord);

module.exports = router;
