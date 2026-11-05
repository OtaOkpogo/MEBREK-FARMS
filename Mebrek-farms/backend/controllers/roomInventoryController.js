const RoomInventory = require("../models/RoomInventory");
const { logAudit } = require("../utils/auditLogger");

// ============================================================
// HELPERS
// ============================================================

// Push a history entry without a separate save() round trip.
const pushHistory = (doc, event, note, adminId) => {
  doc.history.push({
    event,
    note,
    by: adminId || null,
    date: new Date(),
  });
};

// Keep audit snapshots limited to relevant inventory information.
const getRoomInventoryAuditSnapshot = (item) => {
  if (!item) return null;

  const data = item.toObject ? item.toObject() : item;

  return {
    roomName: data.roomName,
    roomType: data.roomType,
    itemName: data.itemName,
    category: data.category,
    quantity: data.quantity,
    condition: data.condition,
    serialNumber: data.serialNumber,
    purchaseDate: data.purchaseDate,
    purchaseValue: data.purchaseValue,
    remarks: data.remarks,
    assignedTo: data.assignedTo?._id || data.assignedTo || null,
    status: data.status,
  };
};

// ============================================================
// POST /api/room-inventory
// ============================================================

exports.createItem = async (req, res) => {
  try {
    const {
      roomName,
      roomType,
      itemName,
      category,
      quantity,
      condition,
      serialNumber,
      purchaseDate,
      purchaseValue,
      remarks,
      assignedTo,
    } = req.body;

    if (!roomName || !itemName) {
      return res
        .status(400)
        .json({ message: "roomName and itemName are required." });
    }

    const item = new RoomInventory({
      roomName,
      roomType,
      itemName,
      category,
      quantity,
      condition,
      serialNumber,
      purchaseDate,
      purchaseValue,
      remarks,
      assignedTo: assignedTo || null,
      createdBy: req.user?._id,
    });

    pushHistory(item, "Created", "Item added to inventory", req.user?._id);

    await item.save();

    await logAudit(req, {
      action: "CREATE",
      module: "Room Inventory",
      description: `Added ${item.itemName} to ${item.roomName}`,
      entityId: item._id,
      entityName: item.itemName,
      after: getRoomInventoryAuditSnapshot(item),
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error("createItem error:", err);
    return res.status(500).json({ message: "Failed to create item." });
  }
};

// ============================================================
// PUT /api/room-inventory/:id
// ============================================================

exports.updateItem = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const before = getRoomInventoryAuditSnapshot(item);
    const changes = [];

    const editableFields = [
      "roomName",
      "roomType",
      "itemName",
      "category",
      "quantity",
      "serialNumber",
      "purchaseDate",
      "purchaseValue",
      "remarks",
    ];

    editableFields.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== item[field]?.toString?.() &&
        req.body[field] !== item[field]
      ) {
        changes.push(field);
        item[field] = req.body[field];
      }
    });

    // Condition changes receive their own history event.
    if (req.body.condition && req.body.condition !== item.condition) {
      pushHistory(
        item,
        "Condition Changed",
        `${item.condition} -> ${req.body.condition}`,
        req.user?._id,
      );

      if (!changes.includes("condition")) {
        changes.push("condition");
      }

      item.condition = req.body.condition;
    }

    if (changes.length > 0) {
      pushHistory(
        item,
        "Edited",
        `Updated fields: ${changes.join(", ")}`,
        req.user?._id,
      );

      await item.save();

      await logAudit(req, {
        action: "UPDATE",
        module: "Room Inventory",
        description: `Updated ${item.itemName} in ${item.roomName}`,
        entityId: item._id,
        entityName: item.itemName,
        before,
        after: getRoomInventoryAuditSnapshot(item),
        metadata: {
          changedFields: changes,
        },
      });
    }

    return res.json(item);
  } catch (err) {
    console.error("updateItem error:", err);
    return res.status(500).json({ message: "Failed to update item." });
  }
};

// ============================================================
// DELETE /api/room-inventory/:id
// Soft delete by default.
// Pass ?hard=true to permanently remove the document.
// ============================================================

exports.deleteItem = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const before = getRoomInventoryAuditSnapshot(item);

    if (req.query.hard === "true") {
      await item.deleteOne();

      await logAudit(req, {
        action: "DELETE",
        module: "Room Inventory",
        description: `Permanently deleted ${item.itemName} from ${item.roomName}`,
        entityId: item._id,
        entityName: item.itemName,
        before,
        after: null,
        metadata: {
          permanent: true,
        },
      });

      return res.json({ message: "Item permanently deleted." });
    }

    item.status = "Removed";

    pushHistory(
      item,
      "Deleted",
      "Item removed from active inventory",
      req.user?._id,
    );

    await item.save();

    await logAudit(req, {
      action: "DELETE",
      module: "Room Inventory",
      description: `Removed ${item.itemName} from ${item.roomName}`,
      entityId: item._id,
      entityName: item.itemName,
      before,
      after: getRoomInventoryAuditSnapshot(item),
      metadata: {
        permanent: false,
      },
    });

    return res.json({ message: "Item marked as removed.", item });
  } catch (err) {
    console.error("deleteItem error:", err);
    return res.status(500).json({ message: "Failed to delete item." });
  }
};

// ============================================================
// GET /api/room-inventory/rooms
// ============================================================

exports.listRooms = async (req, res) => {
  try {
    const rooms = await RoomInventory.aggregate([
      { $match: { status: { $ne: "Removed" } } },
      {
        $group: {
          _id: { roomName: "$roomName", roomType: "$roomType" },
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          damagedCount: {
            $sum: {
              $cond: [
                { $in: ["$condition", ["Damaged", "Needs Repair"]] },
                1,
                0,
              ],
            },
          },
          missingCount: {
            $sum: { $cond: [{ $eq: ["$status", "Missing"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          roomName: "$_id.roomName",
          roomType: "$_id.roomType",
          totalItems: 1,
          totalQuantity: 1,
          damagedCount: 1,
          missingCount: 1,
        },
      },
      { $sort: { roomName: 1 } },
    ]);

    return res.json(rooms);
  } catch (err) {
    console.error("listRooms error:", err);
    return res.status(500).json({ message: "Failed to list rooms." });
  }
};

// ============================================================
// GET /api/room-inventory/rooms/:roomName
// ============================================================

exports.getItemsByRoom = async (req, res) => {
  try {
    const { roomName } = req.params;

    const items = await RoomInventory.find({
      roomName: { $regex: `^${roomName}$`, $options: "i" },
      status: { $ne: "Removed" },
    })
      .populate("assignedTo", "name role")
      .sort({ itemName: 1 });

    return res.json(items);
  } catch (err) {
    console.error("getItemsByRoom error:", err);
    return res.status(500).json({ message: "Failed to fetch room items." });
  }
};

// ============================================================
// GET /api/room-inventory
// ============================================================

exports.getAllItems = async (req, res) => {
  try {
    const { condition, category, status, roomType, search } = req.query;

    const query = { status: { $ne: "Removed" } };

    if (condition) query.condition = condition;
    if (category) query.category = category;
    if (roomType) query.roomType = roomType;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: "i" } },
        { roomName: { $regex: search, $options: "i" } },
        { serialNumber: { $regex: search, $options: "i" } },
      ];
    }

    const items = await RoomInventory.find(query)
      .populate("assignedTo", "name role")
      .sort({ roomName: 1, itemName: 1 });

    return res.json(items);
  } catch (err) {
    console.error("getAllItems error:", err);
    return res.status(500).json({ message: "Failed to fetch items." });
  }
};

// ============================================================
// GET /api/room-inventory/:id
// ============================================================

exports.getItemById = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id).populate(
      "assignedTo",
      "name role",
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    return res.json(item);
  } catch (err) {
    console.error("getItemById error:", err);
    return res.status(500).json({ message: "Failed to fetch item." });
  }
};

// ============================================================
// PATCH /api/room-inventory/:id/assign
// ============================================================

exports.assignItem = async (req, res) => {
  try {
    const { staffId } = req.body;

    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const before = getRoomInventoryAuditSnapshot(item);
    const previousAssignedTo = item.assignedTo
      ? item.assignedTo.toString()
      : null;
    const nextAssignedTo = staffId || null;

    if (previousAssignedTo !== nextAssignedTo) {
      item.assignedTo = nextAssignedTo;

      pushHistory(
        item,
        staffId ? "Assigned" : "Unassigned",
        staffId ? `Assigned to staff ${staffId}` : "Unassigned",
        req.user?._id,
      );

      await item.save();

      await logAudit(req, {
        action: "UPDATE",
        module: "Room Inventory",
        description: staffId
          ? `Assigned ${item.itemName} to staff member ${staffId}`
          : `Unassigned ${item.itemName}`,
        entityId: item._id,
        entityName: item.itemName,
        before,
        after: getRoomInventoryAuditSnapshot(item),
        metadata: {
          changeType: staffId ? "ASSIGNED" : "UNASSIGNED",
          previousAssignedTo,
          assignedTo: nextAssignedTo,
        },
      });
    }

    return res.json(item);
  } catch (err) {
    console.error("assignItem error:", err);
    return res.status(500).json({ message: "Failed to assign item." });
  }
};

// ============================================================
// PATCH /api/room-inventory/:id/status
// ============================================================

exports.updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const validTransitions = {
      "Checked Out": "Checked Out",
      "Checked In": "Checked In",
      Missing: "Missing",
      Found: "Found",
    };

    if (!validTransitions[status]) {
      return res.status(400).json({ message: "Invalid status transition." });
    }

    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    const before = getRoomInventoryAuditSnapshot(item);

    const nextStatus =
      status === "Checked In" || status === "Found"
        ? "In Room"
        : validTransitions[status];

    const previousStatus = item.status;

    const eventMap = {
      "Checked Out": "Checked Out",
      "Checked In": "Checked In",
      Missing: "Marked Missing",
      Found: "Marked Found",
    };

    if (previousStatus !== nextStatus) {
      item.status = nextStatus;

      pushHistory(item, eventMap[status], note, req.user?._id);

      await item.save();

      await logAudit(req, {
        action: "STATUS_CHANGE",
        module: "Room Inventory",
        description: `${item.itemName} status changed from ${previousStatus} to ${nextStatus}`,
        entityId: item._id,
        entityName: item.itemName,
        before,
        after: getRoomInventoryAuditSnapshot(item),
        metadata: {
          requestedTransition: status,
          previousStatus,
          newStatus: nextStatus,
          note: note || null,
        },
      });
    }

    return res.json(item);
  } catch (err) {
    console.error("updateStatus error:", err);
    return res.status(500).json({ message: "Failed to update status." });
  }
};

// ============================================================
// GET /api/room-inventory/summary
// ============================================================

exports.getInventorySummary = async (req, res) => {
  try {
    const [byCondition, byStatus, byCategory, totals] = await Promise.all([
      RoomInventory.aggregate([
        { $match: { status: { $ne: "Removed" } } },
        { $group: { _id: "$condition", count: { $sum: 1 } } },
      ]),
      RoomInventory.aggregate([
        { $match: { status: { $ne: "Removed" } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      RoomInventory.aggregate([
        { $match: { status: { $ne: "Removed" } } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
      RoomInventory.aggregate([
        { $match: { status: { $ne: "Removed" } } },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            totalQuantity: { $sum: "$quantity" },
            totalValue: { $sum: { $ifNull: ["$purchaseValue", 0] } },
          },
        },
      ]),
    ]);

    return res.json({
      byCondition,
      byStatus,
      byCategory,
      totals: totals[0] || {
        totalItems: 0,
        totalQuantity: 0,
        totalValue: 0,
      },
    });
  } catch (err) {
    console.error("getInventorySummary error:", err);
    return res.status(500).json({ message: "Failed to generate summary." });
  }
};

// ============================================================
// GET /api/room-inventory/missing
// ============================================================

exports.getMissingItems = async (req, res) => {
  try {
    const items = await RoomInventory.find({ status: "Missing" })
      .populate("assignedTo", "name role")
      .sort({ roomName: 1 });

    return res.json(items);
  } catch (err) {
    console.error("getMissingItems error:", err);
    return res.status(500).json({ message: "Failed to fetch missing items." });
  }
};
