const RoomAudit = require("../models/RoomAudit");
const Room = require("../models/Room");

// Tunable condition penalty weights.
// "Good" costs nothing. "Damaged" and "Missing" reduce the item's score.
// Adjust these to match how strict inspections should be.
const CONDITION_WEIGHT = {
  Good: 1,
  Damaged: 0.7,
  Missing: 0,
};

/**
 * Calculates an overall audit score (0-100) from the per-item results.
 * Each item's score blends:
 *  - quantity accuracy (foundQuantity / expectedQuantity, capped at 100%)
 *  - a condition penalty (Damaged/Missing pull the score down further)
 * The final score is the average across all items, expected-quantity weighted
 * so rooms with more items of a given type aren't skewed by a single unit.
 */
function calculateAuditScore(items = []) {
  if (!items.length) return null;

  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const item of items) {
    const expected = Number(item.expectedQuantity) || 0;
    const found = Number(item.foundQuantity) || 0;

    if (expected <= 0) continue;

    const quantityRatio = Math.min(found / expected, 1);
    const conditionMultiplier =
      CONDITION_WEIGHT[item.condition] ?? CONDITION_WEIGHT.Good;

    const itemScore = quantityRatio * conditionMultiplier * 100;

    weightedScoreSum += itemScore * expected;
    totalWeight += expected;
  }

  if (totalWeight === 0) return null;

  return Math.round(weightedScoreSum / totalWeight);
}

// POST /api/room-audits
exports.createAudit = async (req, res) => {
  try {
    const { room, items, notes, status } = req.body;

    if (!room) {
      return res.status(400).json({ message: "Room is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one item result is required" });
    }

    const roomExists = await Room.findById(room);
    if (!roomExists) {
      return res.status(404).json({ message: "Room not found" });
    }

    const score = calculateAuditScore(items);

    const audit = await RoomAudit.create({
      room,
      inspectedBy: req.user.id,
      items,
      score,
      notes,
      status: status || "completed",
    });

    res.status(201).json({
      message: "Audit completed successfully",
      score,
      audit,
    });
  } catch (error) {
    console.error("CREATE AUDIT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/room-audits
// Supports optional query filters: ?status=completed&minScore=80&maxScore=100
exports.getAudits = async (req, res) => {
  try {
    const { status, minScore, maxScore } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (minScore || maxScore) {
      filter.score = {};
      if (minScore) filter.score.$gte = Number(minScore);
      if (maxScore) filter.score.$lte = Number(maxScore);
    }

    const audits = await RoomAudit.find(filter)
      .populate("room", "name type")
      .populate("inspectedBy", "name email")
      .sort({ createdAt: -1 });

    res.json(audits);
  } catch (error) {
    console.error("GET AUDITS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/room-audits/room/:roomId
exports.getRoomAudits = async (req, res) => {
  try {
    const { roomId } = req.params;

    const audits = await RoomAudit.find({ room: roomId })
      .populate("inspectedBy", "name email")
      .populate("items.inventoryItem", "name category")
      .sort({ createdAt: -1 });

    res.json(audits);
  } catch (error) {
    console.error("GET ROOM AUDITS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/room-audits/:id
exports.deleteAudit = async (req, res) => {
  try {
    const audit = await RoomAudit.findById(req.params.id);

    if (!audit) {
      return res.status(404).json({ message: "Audit not found" });
    }

    await audit.deleteOne();

    res.json({ message: "Audit deleted successfully" });
  } catch (error) {
    console.error("DELETE AUDIT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// Exported so other controllers (e.g. room listing, dashboard stats)
// can compute the same health badge from a score without duplicating logic.
exports.getHealthBadge = (score) => {
  if (score === null || score === undefined) return { label: "Not audited", color: "gray" };
  if (score >= 98) return { label: "Excellent", color: "green" };
  if (score >= 90) return { label: "Good", color: "yellow" };
  if (score >= 80) return { label: "Needs Attention", color: "orange" };
  return { label: "Critical", color: "red" };
};
