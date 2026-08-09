const express = require("express");

const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");

const {
  getWarehouseItems,
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  restoreWarehouseItem,
} = require("../controllers/warehouseController");

// SUPERADMIN + MANAGER — matches Warehouse's access level in App.jsx.
// Previously these four routes only checked authentication, meaning
// staff could hit them directly regardless of what the frontend hid.
// (restoreWarehouseItem below was already correctly superadmin-only.)

router.get(
  "/",
  protect,
  allowRoles("superadmin", "manager"),
  getWarehouseItems,
);

router.post(
  "/",
  protect,
  allowRoles("superadmin", "manager"),
  createWarehouseItem,
);

router.put(
  "/:id",
  protect,
  allowRoles("superadmin", "manager"),
  updateWarehouseItem,
);

router.delete(
  "/:id",
  protect,
  allowRoles("superadmin", "manager"),
  deleteWarehouseItem,
);

router.put(
  "/:id/restore",
  protect,
  allowRoles("superadmin"),
  restoreWarehouseItem,
);

module.exports = router;
