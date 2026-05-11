const express = require("express");

const router = express.Router();

const auth = require(
  "../middleware/authMiddleware"
);

const {
  getWarehouseItems,
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
} = require(
  "../controllers/warehouseController"
);


router.get(
  "/",
  auth,
  getWarehouseItems
);

router.post(
  "/",
  auth,
  createWarehouseItem
);

router.put(
  "/:id",
  auth,
  updateWarehouseItem
);

router.delete(
  "/:id",
  auth,
  deleteWarehouseItem
);

module.exports = router;
