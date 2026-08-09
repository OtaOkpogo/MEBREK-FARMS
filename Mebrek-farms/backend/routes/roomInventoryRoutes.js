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

// Manager + super admin can manage inventory; staff has no access at
// all, matching the App.jsx frontend restriction on the Room
// Inventory page (allowedRoles=["superadmin","manager"]).
router.use(protect);

router.get("/", allowRoles("manager", "superadmin"), getAllItems);
router.get(
  "/summary",
  allowRoles("manager", "superadmin"),
  getInventorySummary,
);
router.get("/missing", allowRoles("manager", "superadmin"), getMissingItems);
router.get("/rooms", allowRoles("manager", "superadmin"), listRooms);
router.get(
  "/rooms/:roomName",
  allowRoles("manager", "superadmin"),
  getItemsByRoom,
);
router.get("/:id", allowRoles("manager", "superadmin"), getItemById);

router.post("/", allowRoles("manager", "superadmin"), createItem);
router.put("/:id", allowRoles("manager", "superadmin"), updateItem);
router.delete("/:id", allowRoles("manager", "superadmin"), deleteItem);
router.patch("/:id/assign", allowRoles("manager", "superadmin"), assignItem);
router.patch("/:id/status", allowRoles("manager", "superadmin"), updateStatus);

module.exports = router;
