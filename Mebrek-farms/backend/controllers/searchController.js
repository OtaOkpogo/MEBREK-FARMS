const Admin = require("../models/Admin");
const Production = require("../models/Production");
const EggSale = require("../models/EggSale");
const Feed = require("../models/Feed");
const Notification = require("../models/Notification");
const RoomInventory = require("../models/RoomInventory");
const Warehouse = require("../models/Warehouse");
const Order = require("../models/Order");
const Vaccination = require("../models/Vaccination");
const Medication = require("../models/Medication");

// ================= ROLE PERMISSIONS =================
// Single source of truth for which collections each role can search.
// Mirrors dashboardRoutes.js's ROLE_PERMISSIONS pattern — a role that
// can't see a module anywhere else in the app (page, sidebar, direct
// API call) shouldn't be able to find its data through search either.
//
// workers -> Admin.find() (login/admin accounts, not farm workers) —
// superadmin only, matching staffRoutes.js.
// eggSales / feedInventory / roomInventory / warehouse — superadmin +
// manager only, matching their respective route files.
// notifications — superadmin + manager only; staff never sees the
// notification inbox anywhere else (AdminLayout.jsx), so search
// shouldn't surface that content either.
// production / orders / vaccinations / medications — open to all
// roles, matching App.jsx (no allowedRoles set on those pages).
const SEARCH_PERMISSIONS = {
  superadmin: {
    workers: true,
    production: true,
    eggSales: true,
    feedInventory: true,
    roomInventory: true,
    notifications: true,
    warehouse: true,
    orders: true,
    vaccinations: true,
    medications: true,
  },
  manager: {
    workers: false,
    production: true,
    eggSales: true,
    feedInventory: true,
    roomInventory: true,
    notifications: true,
    warehouse: true,
    orders: true,
    vaccinations: true,
    medications: true,
  },
  staff: {
    workers: false,
    production: true,
    eggSales: false,
    feedInventory: false,
    roomInventory: false,
    notifications: false,
    warehouse: false,
    orders: true,
    vaccinations: true,
    medications: true,
  },
};

exports.globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    const emptyResult = {
      workers: [],
      production: [],
      eggSales: [],
      feedInventory: [],
      roomInventory: [],
      notifications: [],
      warehouse: [],
      orders: [],
      vaccinations: [],
      medications: [],
    };

    if (q.length < 2) {
      return res.json(emptyResult);
    }

    const role = req.user?.role || "staff";
    const perms = SEARCH_PERMISSIONS[role] || SEARCH_PERMISSIONS.staff;

    const textQuery = { $text: { $search: q } };
    const textScore = { score: { $meta: "textScore" } };
    const sortByScore = { score: { $meta: "textScore" } };

    // Only query collections this role is actually allowed to search.
    // Disallowed collections resolve to [] without hitting the DB —
    // same pattern as dashboardRoutes.js.
    const [
      workers,
      production,
      eggSales,
      feedInventory,
      roomInventory,
      notifications,
      warehouse,
      orders,
      vaccinations,
      medications,
    ] = await Promise.all([
      perms.workers
        ? Admin.find(textQuery, textScore)
            .select("name email role status score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.production
        ? Production.find(textQuery, textScore)
            .select("pen date cratesProduced productionPercentage score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.eggSales
        ? EggSale.find(textQuery, textScore)
            .select("customer phone totalAmount status date score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.feedInventory
        ? Feed.find(textQuery, textScore)
            .select("name quantity unit supplier pricePerUnit score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.roomInventory
        ? RoomInventory.find(textQuery, textScore)
            .select("roomName itemName category quantity condition score")
            .limit(10)
        : Promise.resolve([]),

      perms.notifications
        ? Notification.find(textQuery, textScore)
            .select("subject message senderName senderRole createdAt score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.warehouse
        ? Warehouse.find({ ...textQuery, isDeleted: false }, textScore)
            .select("itemName category quantity unit location status score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.orders
        ? Order.find(textQuery, textScore)
            .select("name contact message status createdAt score")
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.vaccinations
        ? Vaccination.find({ ...textQuery, isDeleted: false }, textScore)
            .select(
              "vaccineName birdBatch quantity administeredBy nextDueDate score",
            )
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),

      perms.medications
        ? Medication.find({ ...textQuery, isDeleted: false }, textScore)
            .select(
              "medicationName dosage purpose administeredTo dateAdministered score",
            )
            .sort(sortByScore)
            .limit(10)
        : Promise.resolve([]),
    ]);

    res.json({
      workers,
      production,
      eggSales,
      feedInventory,
      roomInventory,
      notifications,
      warehouse,
      orders,
      vaccinations,
      medications,
    });
  } catch (err) {
    console.error("GLOBAL SEARCH ERROR:", err);

    res.status(500).json({
      message: "Search failed.",
    });
  }
};
