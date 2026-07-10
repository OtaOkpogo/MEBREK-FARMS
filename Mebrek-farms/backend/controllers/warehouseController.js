const Warehouse = require("../models/Warehouse");

// ================= GET =================

exports.getWarehouseItems = async (req, res) => {
  try {
    if (req.user.role === "superadmin") {
      const items = await Warehouse.find().sort({
        createdAt: -1,
      });

      return res.json(items);
    }

    const items = await Warehouse.find({
      isDeleted: false,
    }).sort({
      createdAt: -1,
    });

    res.json(items);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= CREATE =================

exports.createWarehouseItem = async (req, res) => {
  try {
    const item = new Warehouse(req.body);

    await item.save();

    res.json(item);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= UPDATE =================

exports.updateWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        message: "Warehouse item not found",
      });
    }

    res.json(item);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= DELETE =================

exports.deleteWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "Warehouse item not found",
      });
    }

    item.isDeleted = true;
    item.deletedAt = new Date();
    item.deletedBy = req.user.role;

    await item.save();

    res.json({
      message: "Warehouse item deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= RESTORE =================

exports.restoreWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "Warehouse item not found",
      });
    }

    if (!item.isDeleted) {
      return res.status(400).json({
        message: "Warehouse item is not deleted",
      });
    }

    item.isDeleted = false;
    item.deletedAt = null;
    item.deletedBy = "";

    await item.save();

    res.json({
      message: "Warehouse item restored successfully",
      item,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};
