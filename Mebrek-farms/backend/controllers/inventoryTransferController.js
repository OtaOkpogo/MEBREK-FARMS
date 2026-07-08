const mongoose = require("mongoose");
const Room = require("../models/Room");
const InventoryItem = require("../models/InventoryItem");
const InventoryTransfer = require("../models/InventoryTransfer");

// POST /api/inventory-transfers
exports.transferItem = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { item, fromRoom, toRoom, quantity, reason } = req.body;

    if (!item || !fromRoom || !toRoom || !quantity) {
      return res.status(400).json({
        message: "item, fromRoom, toRoom, and quantity are required",
      });
    }

    if (fromRoom === toRoom) {
      return res
        .status(400)
        .json({
          message: "Destination room must be different from the current room",
        });
    }

    const transferQty = Number(quantity);
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }

    let result;

    await session.withTransaction(async () => {
      const [itemExists, sourceRoom, destinationRoom] = await Promise.all([
        InventoryItem.findById(item).session(session),
        Room.findById(fromRoom).session(session),
        Room.findById(toRoom).session(session),
      ]);

      if (!itemExists) throw new AppError(404, "Item not found");
      if (!sourceRoom) throw new AppError(404, "Source room not found");
      if (!destinationRoom)
        throw new AppError(404, "Destination room not found");

      const sourceEntry = sourceRoom.items.find(
        (entry) => entry.inventoryItem.toString() === item.toString(),
      );

      if (!sourceEntry) {
        throw new AppError(400, "Item is not stocked in the source room");
      }

      if (sourceEntry.quantity < transferQty) {
        throw new AppError(
          400,
          `Insufficient quantity. Only ${sourceEntry.quantity} available in this room.`,
        );
      }

      // Decrement source; remove the line entirely if it hits zero
      sourceEntry.quantity -= transferQty;
      if (sourceEntry.quantity === 0) {
        sourceRoom.items.pull(sourceEntry._id);
      }

      // Increment destination, or create the line if it doesn't stock this item yet
      const destinationEntry = destinationRoom.items.find(
        (entry) => entry.inventoryItem.toString() === item.toString(),
      );

      if (destinationEntry) {
        destinationEntry.quantity += transferQty;
      } else {
        destinationRoom.items.push({
          inventoryItem: item,
          quantity: transferQty,
          condition: sourceEntry.condition || "Good",
          status: sourceEntry.status || "in_use",
        });
      }

      await sourceRoom.save({ session });
      await destinationRoom.save({ session });

      const [transferRecord] = await InventoryTransfer.create(
        [
          {
            item,
            fromRoom,
            toRoom,
            quantity: transferQty,
            transferredBy: req.user.id,
            reason,
          },
        ],
        { session },
      );

      result = {
        transfer: transferRecord,
        sourceRoomRemainingQty: sourceEntry.quantity,
        destinationRoomQty: destinationEntry
          ? destinationEntry.quantity
          : transferQty,
      };
    });

    res.status(201).json({
      message: "Transfer completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("TRANSFER ITEM ERROR:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message || "Server error" });
  } finally {
    session.endSession();
  }
};

// GET /api/inventory-transfers
// Optional filters: ?item=<id>&fromRoom=<id>&toRoom=<id>
exports.getTransfers = async (req, res) => {
  try {
    const { item, fromRoom, toRoom } = req.query;

    const filter = {};
    if (item) filter.item = item;
    if (fromRoom) filter.fromRoom = fromRoom;
    if (toRoom) filter.toRoom = toRoom;

    const transfers = await InventoryTransfer.find(filter)
      .populate("item", "name category")
      .populate("fromRoom", "name")
      .populate("toRoom", "name")
      .populate("transferredBy", "name email")
      .sort({ createdAt: -1 });

    res.json(transfers);
  } catch (error) {
    console.error("GET TRANSFERS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/inventory-transfers/room/:roomId
// Any transfer touching this room, either as source or destination
exports.getRoomTransfers = async (req, res) => {
  try {
    const { roomId } = req.params;

    const transfers = await InventoryTransfer.find({
      $or: [{ fromRoom: roomId }, { toRoom: roomId }],
    })
      .populate("item", "name category")
      .populate("fromRoom", "name")
      .populate("toRoom", "name")
      .populate("transferredBy", "name email")
      .sort({ createdAt: -1 });

    res.json(transfers);
  } catch (error) {
    console.error("GET ROOM TRANSFERS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/inventory-transfers/:id
// Deletes the log entry only — does NOT reverse the quantity change.
// See note below on why.
exports.deleteTransfer = async (req, res) => {
  try {
    const transfer = await InventoryTransfer.findById(req.params.id);

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    await transfer.deleteOne();

    res.json({ message: "Transfer record deleted successfully" });
  } catch (error) {
    console.error("DELETE TRANSFER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// Small helper so throw new AppError(status, message) reads cleanly above
function AppError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
