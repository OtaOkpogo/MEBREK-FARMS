const RoomInventory = require("../models/RoomInventory");

// Helper to push a history entry without a separate save() round trip
const pushHistory = (doc, event, note, adminId) => {
  doc.history.push({ event, note, by: adminId || null, date: new Date() });
};

// POST /api/room-inventory
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

    return res.status(201).json(item);
  } catch (err) {
    console.error("createItem error:", err);
    return res.status(500).json({ message: "Failed to create item." });
  }
};

// PUT /api/room-inventory/:id
exports.updateItem = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

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

    const changes = [];

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

    // Condition changes get their own history event since they matter for audits
    if (req.body.condition && req.body.condition !== item.condition) {
      pushHistory(
        item,
        "Condition Changed",
        `${item.condition} -> ${req.body.condition}`,
        req.user?._id
      );
      item.condition = req.body.condition;
    }

    if (changes.length > 0) {
      pushHistory(
        item,
        "Edited",
        `Updated fields: ${changes.join(", ")}`,
        req.user?._id
      );
    }

    await item.save();

    return res.json(item);
  } catch (err) {
    console.error("updateItem error:", err);
    return res.status(500).json({ message: "Failed to update item." });
  }
};

// DELETE /api/room-inventory/:id
// Soft delete by default (status: Removed) so history/audit trail survives.
// Pass ?hard=true to permanently remove the document.
exports.deleteItem = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    if (req.query.hard === "true") {
      await item.deleteOne();
      return res.json({ message: "Item permanently deleted." });
    }

    item.status = "Removed";
    pushHistory(item, "Deleted", "Item removed from active inventory", req.user?._id);
    await item.save();

    return res.json({ message: "Item marked as removed.", item });
  } catch (err) {
    console.error("deleteItem error:", err);
    return res.status(500).json({ message: "Failed to delete item." });
  }
};

// GET /api/room-inventory/rooms
// List distinct rooms with item counts and unread-style summary stats
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

// GET /api/room-inventory/rooms/:roomName
// All items in a specific room (case-insensitive exact match)
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

// GET /api/room-inventory
// General list with optional filters: ?condition=&category=&status=&search=&roomType=
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

// GET /api/room-inventory/:id
exports.getItemById = async (req, res) => {
  try {
    const item = await RoomInventory.findById(req.params.id).populate(
      "assignedTo",
      "name role"
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

// PATCH /api/room-inventory/:id/assign
exports.assignItem = async (req, res) => {
  try {
    const { staffId } = req.body;

    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    item.assignedTo = staffId || null;
    pushHistory(
      item,
      staffId ? "Assigned" : "Unassigned",
      staffId ? `Assigned to staff ${staffId}` : "Unassigned",
      req.user?._id
    );

    await item.save();

    return res.json(item);
  } catch (err) {
    console.error("assignItem error:", err);
    return res.status(500).json({ message: "Failed to assign item." });
  }
};

// PATCH /api/room-inventory/:id/status
// Body: { status: "Checked Out" | "Checked In" | "Missing" | "Found", note }
exports.updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;

    const validTransitions = {
      "Checked Out": "Checked Out",
      "Checked In": "In Room",
      Missing: "Missing",
      Found: "In Room",
    };

    if (!validTransitions[status]) {
      return res.status(400).json({ message: "Invalid status transition." });
    }

    const item = await RoomInventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    item.status = validTransitions[status];

    const eventMap = {
      "Checked Out": "Checked Out",
      "Checked In": "Checked In",
      Missing: "Marked Missing",
      Found: "Marked Found",
    };

    pushHistory(item, eventMap[status], note, req.user?._id);

    await item.save();

    return res.json(item);
  } catch (err) {
    console.error("updateStatus error:", err);
    return res.status(500).json({ message: "Failed to update status." });
  }
};

// GET /api/room-inventory/summary
// Company-wide inventory summary — counts by condition/status/category
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
      totals: totals[0] || { totalItems: 0, totalQuantity: 0, totalValue: 0 },
    });
  } catch (err) {
    console.error("getInventorySummary error:", err);
    return res.status(500).json({ message: "Failed to generate summary." });
  }
};

// GET /api/room-inventory/missing
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
