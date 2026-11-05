const Warehouse = require("../models/Warehouse");
const { logAudit } = require("../utils/auditLogger");

// ============================================================
// AUDIT SNAPSHOT
// ============================================================

const getWarehouseAuditSnapshot = (item) => {
  if (!item) return null;

  const data = typeof item.toObject === "function" ? item.toObject() : item;

  return {
    itemName: data.itemName,
    category: data.category,
    quantity: data.quantity,
    unit: data.unit,
    location: data.location,
    status: data.status,
    isDeleted: data.isDeleted,
    deletedAt: data.deletedAt,
    deletedBy: data.deletedBy,
  };
};

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

    await logAudit(req, {
      action: "CREATE",
      module: "Warehouse",
      description: `Added warehouse item: ${item.itemName}`,
      entityId: item._id,
      entityName: item.itemName,
      after: getWarehouseAuditSnapshot(item),
      metadata: {
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
      },
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= UPDATE =================

// Only these fields can be changed through the regular update
// endpoint. Deletion and restoration fields remain protected.

const UPDATABLE_FIELDS = [
  "itemName",
  "category",
  "quantity",
  "unit",
  "location",
  "status",
];

exports.updateWarehouseItem = async (req, res) => {
  try {
    const updates = {};

    UPDATABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Get the original record before applying changes.
    const existingItem = await Warehouse.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({
        message: "Warehouse item not found",
      });
    }

    const beforeSnapshot = getWarehouseAuditSnapshot(existingItem);

    const item = await Warehouse.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        message: "Warehouse item not found",
      });
    }

    const afterSnapshot = getWarehouseAuditSnapshot(item);

    if (JSON.stringify(beforeSnapshot) !== JSON.stringify(afterSnapshot)) {
      await logAudit(req, {
        action: "UPDATE",
        module: "Warehouse",
        description: `Updated warehouse item: ${item.itemName}`,
        entityId: item._id,
        entityName: item.itemName,
        before: beforeSnapshot,
        after: afterSnapshot,
        metadata: {
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          location: item.location,
        },
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

    const beforeSnapshot = getWarehouseAuditSnapshot(item);

    item.isDeleted = true;
    item.deletedAt = new Date();
    item.deletedBy = req.user.role;

    await item.save();

    await logAudit(req, {
      action: "DELETE",
      module: "Warehouse",
      description: `Deleted warehouse item: ${item.itemName}`,
      entityId: item._id,
      entityName: item.itemName,
      before: beforeSnapshot,
      after: getWarehouseAuditSnapshot(item),
      metadata: {
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
      },
    });

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

    const beforeSnapshot = getWarehouseAuditSnapshot(item);

    item.isDeleted = false;
    item.deletedAt = null;
    item.deletedBy = "";

    await item.save();

    await logAudit(req, {
      action: "RESTORE",
      module: "Warehouse",
      description: `Restored warehouse item: ${item.itemName}`,
      entityId: item._id,
      entityName: item.itemName,
      before: beforeSnapshot,
      after: getWarehouseAuditSnapshot(item),
      metadata: {
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
      },
    });

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
