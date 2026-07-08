const mongoose = require("mongoose");
const Maintenance = require("../models/Maintenance");

// GET /api/maintenance-reports/completed-this-month
exports.getCompletedThisMonth = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const completed = await Maintenance.find({
      status: "Completed",
      completedDate: { $gte: startOfMonth },
    })
      .populate("item", "name category")
      .populate("room", "name")
      .populate("assignedTo", "name")
      .sort({ completedDate: -1 });

    res.json({ count: completed.length, repairs: completed });
  } catch (error) {
    console.error("GET COMPLETED THIS MONTH ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/maintenance-reports/highest-cost-items?limit=10
exports.getHighestCostItems = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const results = await Maintenance.aggregate([
      {
        $group: {
          _id: "$item",
          totalCost: { $sum: "$actualCost" },
          repairCount: { $sum: 1 },
        },
      },
      { $sort: { totalCost: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "inventoryitems",
          localField: "_id",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: "$item" },
      {
        $project: {
          _id: 0,
          item: { _id: "$item._id", name: "$item.name", category: "$item.category" },
          totalCost: 1,
          repairCount: 1,
        },
      },
    ]);

    res.json(results);
  } catch (error) {
    console.error("GET HIGHEST COST ITEMS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/maintenance-reports/rooms-most-requests?limit=10
exports.getRoomsWithMostRequests = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const results = await Maintenance.aggregate([
      {
        $group: {
          _id: "$room",
          requestCount: { $sum: 1 },
        },
      },
      { $sort: { requestCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "rooms",
          localField: "_id",
          foreignField: "_id",
          as: "room",
        },
      },
      { $unwind: "$room" },
      {
        $project: {
          _id: 0,
          room: { _id: "$room._id", name: "$room.name", type: "$room.type" },
          requestCount: 1,
        },
      },
    ]);

    res.json(results);
  } catch (error) {
    console.error("GET ROOMS MOST REQUESTS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/maintenance-reports/average-repair-time
// "Repair time" = completedDate - createdAt (report date), in days.
exports.getAverageRepairTime = async (req, res) => {
  try {
    const result = await Maintenance.aggregate([
      {
        $match: {
          status: "Completed",
          completedDate: { $ne: null },
        },
      },
      {
        $project: {
          repairDurationMs: { $subtract: ["$completedDate", "$createdAt"] },
        },
      },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: "$repairDurationMs" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!result.length) {
      return res.json({ averageDays: 0, sampleSize: 0 });
    }

    const averageDays = result[0].avgDurationMs / (1000 * 60 * 60 * 24);

    res.json({
      averageDays: Math.round(averageDays * 10) / 10,
      sampleSize: result[0].count,
    });
  } catch (error) {
    console.error("GET AVERAGE REPAIR TIME ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/maintenance-reports/outstanding
exports.getOutstandingRepairs = async (req, res) => {
  try {
    const outstanding = await Maintenance.find({
      status: { $in: ["Reported", "Assigned", "In Progress"] },
    })
      .populate("item", "name category")
      .populate("room", "name")
      .populate("assignedTo", "name")
      .sort({ priority: 1, createdAt: 1 });

    res.json(outstanding);
  } catch (error) {
    console.error("GET OUTSTANDING REPAIRS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/maintenance-reports/cost-by-building
// Requires Room to have a "building" field (e.g. "Staff Quarters", "Manager House").
// Adjust the field name below if yours differs.
exports.getCostByBuilding = async (req, res) => {
  try {
    const results = await Maintenance.aggregate([
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "roomDetails",
        },
      },
      { $unwind: "$roomDetails" },
      {
        $group: {
          _id: "$roomDetails.building",
          totalCost: { $sum: "$actualCost" },
          repairCount: { $sum: 1 },
        },
      },
      { $sort: { totalCost: -1 } },
      {
        $project: {
          _id: 0,
          building: "$_id",
          totalCost: 1,
          repairCount: 1,
        },
      },
    ]);

    res.json(results);
  } catch (error) {
    console.error("GET COST BY BUILDING ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};
