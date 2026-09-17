const express = require("express");
const router = express.Router();

const { protect: auth } = require("../middleware/authMiddleware");

const Order = require("../models/Order");
const Worker = require("../models/Worker");
const Production = require("../models/Production");
const Feed = require("../models/Feed");
const Attendance = require("../models/Attendance");
const RoomInventory = require("../models/RoomInventory");
const Mortality = require("../models/Mortality");
const Vaccination = require("../models/Vaccination");

// ================= ROLE PERMISSIONS =================

const ROLE_PERMISSIONS = {
  superadmin: {
    revenue: true,
    orders: true,
    workers: true,
    production: true,
    feedStock: true,
    mortality: true,
    attendance: true,
    roomInventory: true,
    workerPerformance: true,
    vaccinations: true,
  },

  manager: {
    revenue: false,
    orders: true,
    workers: true,
    production: true,
    feedStock: true,
    mortality: true,
    attendance: true,
    roomInventory: true,
    workerPerformance: true,
    vaccinations: true,
  },

  staff: {
    revenue: false,
    orders: false,
    workers: false,
    production: true,
    feedStock: false,
    mortality: false,
    attendance: true,
    roomInventory: false,
    workerPerformance: false,
    vaccinations: true,
  },
};

const REVENUE_PER_EGG = 5000;

router.get("/", auth, async (req, res) => {
  try {
    const role = req.user?.role || "staff";
    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;

    // ================= MAIN DATA =================

    const [
      orders,
      workers,
      production,
      feeds,
      attendance,
      mortality,
      roomInventory,
      vaccinations,
    ] = await Promise.all([
      perms.orders ? Order.find() : Promise.resolve([]),

      perms.workers || perms.workerPerformance
        ? Worker.find()
        : Promise.resolve([]),

      perms.production || perms.revenue
        ? Production.find()
        : Promise.resolve([]),

      perms.feedStock ? Feed.find() : Promise.resolve([]),

      perms.attendance ? Attendance.find() : Promise.resolve([]),

      perms.mortality ? Mortality.find() : Promise.resolve([]),

      perms.roomInventory
        ? RoomInventory.find({
            status: { $ne: "Removed" },
          }).sort({ roomName: 1, itemName: 1 })
        : Promise.resolve([]),

      perms.vaccinations ? Vaccination.find() : Promise.resolve([]),
    ]);

    // ================= ROOM SUMMARY =================
    //
    // IMPORTANT:
    // totalItems = number of inventory records
    // totalQuantity = actual number of physical items
    //
    // Example:
    // One record with quantity: 10
    // totalItems = 1
    // totalQuantity = 10

    let roomInventorySummary = [];

    if (perms.roomInventory) {
      roomInventorySummary = await RoomInventory.aggregate([
        {
          $match: {
            status: { $ne: "Removed" },
          },
        },

        {
          $group: {
            _id: {
              roomName: "$roomName",
              roomType: "$roomType",
            },

            totalItems: {
              $sum: 1,
            },

            totalQuantity: {
              $sum: {
                $ifNull: ["$quantity", 0],
              },
            },

            goodQuantity: {
              $sum: {
                $cond: [
                  { $eq: ["$condition", "Good"] },
                  { $ifNull: ["$quantity", 0] },
                  0,
                ],
              },
            },

            damagedQuantity: {
              $sum: {
                $cond: [
                  {
                    $in: ["$condition", ["Damaged", "Needs Repair"]],
                  },
                  { $ifNull: ["$quantity", 0] },
                  0,
                ],
              },
            },

            missingQuantity: {
              $sum: {
                $cond: [
                  { $eq: ["$status", "Missing"] },
                  { $ifNull: ["$quantity", 0] },
                  0,
                ],
              },
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
            goodQuantity: 1,
            damagedQuantity: 1,
            missingQuantity: 1,
          },
        },

        {
          $sort: {
            roomName: 1,
          },
        },
      ]);
    }

    // ================= RESPONSE =================

    const payload = {
      orders: perms.orders ? orders : [],

      workers: perms.workers || perms.workerPerformance ? workers : [],

      production: perms.production ? production : [],

      feeds: perms.feedStock ? feeds : [],

      attendance: perms.attendance ? attendance : [],

      mortality: perms.mortality ? mortality : [],

      roomInventory: perms.roomInventory ? roomInventory : [],

      roomInventorySummary: perms.roomInventory ? roomInventorySummary : [],

      vaccinations: perms.vaccinations ? vaccinations : [],
    };

    // ================= REVENUE =================

    if (perms.revenue) {
      const totalEggs = production.reduce(
        (sum, item) => sum + Number(item.totalEggs || 0),
        0,
      );

      payload.estimatedRevenue = totalEggs * REVENUE_PER_EGG;
    }

    res.json(payload);
  } catch (err) {
    console.error("Dashboard Error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;
