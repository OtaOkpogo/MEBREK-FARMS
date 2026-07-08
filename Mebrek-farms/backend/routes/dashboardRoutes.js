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

router.get("/", auth, async (req, res) => {
  try {
    const [
      orders,
      workers,
      production,
      feeds,
      attendance,
      mortality,
      roomInventory,
    ] = await Promise.all([
      Order.find(),
      Worker.find(),
      Production.find(),
      Feed.find(),
      Attendance.find(),
      Mortality.find(),
      RoomInventory.find(),
    ]);

    res.json({
      orders,
      workers,
      production,
      feeds,
      attendance,
      mortality,
      roomInventory,
    });
  } catch (err) {
    console.error("Dashboard Error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;
