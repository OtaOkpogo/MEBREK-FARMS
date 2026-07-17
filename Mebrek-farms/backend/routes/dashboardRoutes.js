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
// Single source of truth for which dashboard fields each role receives.
// Keep this in sync with ROLE_PERMISSIONS in Dashboard.jsx if you also
// want the frontend map to match — but this backend copy is what
// actually enforces access, since the frontend map is just UI polish.
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
    feedStock: true,
    mortality: false,
    attendance: true,
    roomInventory: true,
    workerPerformance: false,
    vaccinations: true,
  },
};

const REVENUE_PER_EGG = 5000;

router.get("/", auth, async (req, res) => {
  try {
    const role = req.user?.role || "staff";
    const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;

    // Only query models this role is actually allowed to see.
    // Skipped queries resolve to [] rather than hitting the DB at all.
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
      perms.roomInventory ? RoomInventory.find() : Promise.resolve([]),
      perms.vaccinations ? Vaccination.find() : Promise.resolve([]),
    ]);

    const payload = {
      orders: perms.orders ? orders : [],
      workers: perms.workers || perms.workerPerformance ? workers : [],
      production: perms.production ? production : [],
      feeds: perms.feedStock ? feeds : [],
      attendance: perms.attendance ? attendance : [],
      mortality: perms.mortality ? mortality : [],
      roomInventory: perms.roomInventory ? roomInventory : [],
      vaccinations: perms.vaccinations ? vaccinations : [],
    };

    // Revenue is computed here, server-side, and only attached for
    // roles permitted to see it. Non-superadmins never receive the
    // egg totals dressed up as revenue, or a revenue field at all.
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
