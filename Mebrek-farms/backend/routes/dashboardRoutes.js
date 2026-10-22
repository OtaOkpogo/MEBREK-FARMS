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
const FARM_TIME_ZONE = "Africa/Lagos";

// ================= DATE HELPERS =================

const getFarmDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

// Create UTC boundaries for farm calendar dates.
const calendarDateToUTC = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day));

// ================= SUPERADMIN REPORTING PERIODS =================

const getEggProductionPeriods = () => {
  const { year, month, day } = getFarmDateParts();

  const todayStart = calendarDateToUTC(year, month, day);
  const tomorrowStart = calendarDateToUTC(year, month, day + 1);

  // Sunday is the first day of the reporting week.
  // The Saturday boundary is exclusive.
  const dayOfWeek = todayStart.getUTCDay();

  const weekStart = calendarDateToUTC(year, month, day - dayOfWeek);

  const weekEnd = calendarDateToUTC(year, month, day - dayOfWeek + 6);

  const monthStart = calendarDateToUTC(year, month, 1);
  const nextMonthStart = calendarDateToUTC(year, month + 1, 1);

  const yearStart = calendarDateToUTC(year, 1, 1);
  const nextYearStart = calendarDateToUTC(year + 1, 1, 1);

  return {
    daily: {
      start: todayStart,
      end: tomorrowStart,
    },

    weekly: {
      start: weekStart,
      end: weekEnd,
    },

    monthly: {
      start: monthStart,
      end: nextMonthStart,
    },

    yearly: {
      start: yearStart,
      end: nextYearStart,
    },
  };
};

// ================= EGG PRODUCTION AGGREGATION =================

const summarizeEggProduction = async (start, end) => {
  const result = await Production.aggregate([
    {
      $match: {
        date: {
          $gte: start,
          $lt: end,
        },

        // Include records with isDeleted false or missing.
        // Exclude explicitly soft-deleted records.
        isDeleted: { $ne: true },
      },
    },

    {
      $group: {
        _id: null,

        cratesProduced: {
          $sum: {
            $ifNull: ["$cratesProduced", 0],
          },
        },

        extraEggPieces: {
          $sum: {
            $ifNull: ["$extraEggPieces", 0],
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        cratesProduced: 1,
        extraEggPieces: 1,
      },
    },
  ]);

  return (
    result[0] || {
      cratesProduced: 0,
      extraEggPieces: 0,
    }
  );
};

// ================= SUPERADMIN EGG SUMMARY =================

const getEggProductionSummary = async () => {
  const periods = getEggProductionPeriods();

  const [daily, weekly, monthly, yearly] = await Promise.all([
    summarizeEggProduction(periods.daily.start, periods.daily.end),

    summarizeEggProduction(periods.weekly.start, periods.weekly.end),

    summarizeEggProduction(periods.monthly.start, periods.monthly.end),

    summarizeEggProduction(periods.yearly.start, periods.yearly.end),
  ]);

  return {
    daily,
    weekly,
    monthly,
    yearly,
  };
};

// ================= MANAGER: LAST ROLLING 24 HOURS =================

const getLast24HoursEggProduction = async () => {
  const now = new Date();

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  return summarizeEggProduction(
    twentyFourHoursAgo,
    new Date(now.getTime() + 1),
  );
};

// ================= DASHBOARD =================

router.get("/", auth, async (req, res) => {
  try {
    // Support the account property exposed by the auth middleware.
    const account = req.admin || req.user;
    const role = account?.role || "staff";

    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;

    // ================= MAIN DASHBOARD DATA =================

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
          }).sort({
            roomName: 1,
            itemName: 1,
          })
        : Promise.resolve([]),

      perms.vaccinations ? Vaccination.find() : Promise.resolve([]),
    ]);

    // ================= ROOM INVENTORY SUMMARY =================

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

    // ================= RESPONSE PAYLOAD =================

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

    // ================= SUPERADMIN-ONLY REVENUE =================

    if (role === "superadmin" && perms.revenue) {
      const totalEggs = production.reduce(
        (sum, item) => sum + Number(item.totalEggs || 0),
        0,
      );

      payload.estimatedRevenue = totalEggs * REVENUE_PER_EGG;
    }

    // ================= ROLE-BASED EGG PRODUCTION =================

    if (role === "superadmin") {
      // Superadmin gets daily, weekly, monthly and yearly totals.
      payload.eggProductionSummary = await getEggProductionSummary();
    } else if (role === "manager") {
      // Manager gets only the last 24 hours.
      // No weekly, monthly or yearly figures are sent.
      payload.eggProductionSummary = {
        daily: await getLast24HoursEggProduction(),
      };
    }

    // Staff do not receive eggProductionSummary.

    return res.json(payload);
  } catch (err) {
    console.error("Dashboard Error:", err);

    return res.status(500).json({
      message: err.message || "Failed to load dashboard",
    });
  }
});

module.exports = router;
