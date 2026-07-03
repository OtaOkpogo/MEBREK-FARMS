const express = require("express");
const router = express.Router();

const {
  createItem,
  updateItem,
  deleteItem,
  listRooms,
  getItemsByRoom,
  getAllItems,
  getItemById,
  assignItem,
  updateStatus,
  getInventorySummary,
  getMissingItems,
} = require("../controllers/roomInventoryController");

// Adjust these to match your actual auth/role-check middleware names
const { protect, allowRoles } = require("../middleware/authMiddleware");

// Manager + super admin can manage inventory; staff has no write access,
// matching the notifications module's access pattern.
router.use(protect);

router.get("/", getAllItems);
router.get("/summary", getInventorySummary);
router.get("/missing", getMissingItems);
router.get("/rooms", listRooms);
router.get("/rooms/:roomName", getItemsByRoom);
router.get("/:id", getItemById);

router.post("/", allowRoles("manager", "superadmin"), createItem);
router.put("/:id", allowRoles("manager", "superadmin"), updateItem);
router.delete("/:id", allowRoles("manager", "superadmin"), deleteItem);
router.patch("/:id/assign", allowRoles("manager", "superadmin"), assignItem);
router.patch("/:id/status", allowRoles("manager", "superadmin"), updateStatus);

module.exports = router;
