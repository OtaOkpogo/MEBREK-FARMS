const express = require("express");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");

const {
  getWarehouseItems,
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
} = require("../controllers/warehouseController");

router.get("/", protect, getWarehouseItems);

router.post("/", protect, createWarehouseItem);

router.put("/:id", protect, updateWarehouseItem);

router.delete("/:id", protect, deleteWarehouseItem);

module.exports = router;
