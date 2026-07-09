const Admin = require("../models/Admin");
const Production = require("../models/Production");
const EggSale = require("../models/EggSale");
const Feed = require("../models/Feed");
const Notification = require("../models/Notification");
const RoomInventory = require("../models/RoomInventory");

exports.globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();

    if (q.length < 2) {
      return res.json({
        workers: [],
        production: [],
        eggSales: [],
        feedInventory: [],
        roomInventory: [],
        notifications: [],
      });
    }

    const textQuery = { $text: { $search: q } };
    const textScore = { score: { $meta: "textScore" } };
    const sortByScore = { score: { $meta: "textScore" } };

    const [
      workers,
      production,
      eggSales,
      feedInventory,
      roomInventory,
      notifications,
    ] = await Promise.all([
      // STAFF
      Admin.find(textQuery, textScore)
        .select("name email role status score")
        .sort(sortByScore)
        .limit(10),

      // PRODUCTION
      Production.find(textQuery, textScore)
        .select("pen date cratesProduced productionPercentage score")
        .sort(sortByScore)
        .limit(10),

      // EGG SALES
      EggSale.find(textQuery, textScore)
        .select("customer phone totalAmount status date score")
        .sort(sortByScore)
        .limit(10),

      // FEED
      Feed.find(textQuery, textScore)
        .select("name quantity unit supplier pricePerUnit score")
        .sort(sortByScore)
        .limit(10),

      // ROOM INVENTORY
      RoomInventory.find(textQuery, textScore)
        .select("roomName itemName category quantity condition score")
        .limit(10),

      // NOTIFICATIONS
      Notification.find(textQuery, textScore)
        .select("subject message senderName senderRole createdAt score")
        .sort(sortByScore)
        .limit(10),
    ]);

    res.json({
      workers,
      production,
      eggSales,
      feedInventory,
      roomInventory,
      notifications,
    });
  } catch (err) {
    console.error("GLOBAL SEARCH ERROR:", err);

    res.status(500).json({
      message: "Search failed.",
    });
  }
};
