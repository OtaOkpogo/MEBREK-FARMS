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

router.get("/", protect, getWarehouseItems);

router.post("/", protect, createWarehouseItem);

router.put("/:id", protect, updateWarehouseItem);

router.delete("/:id", protect, deleteWarehouseItem);

router.put(
  "/:id/restore",
  protect,
  allowRoles("superadmin"),
  restoreWarehouseItem,
);

module.exports = router;
