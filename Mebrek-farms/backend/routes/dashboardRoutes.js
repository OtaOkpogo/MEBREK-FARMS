const express = require("express");

const router = express.Router();

const auth = require(
  "../middleware/authMiddleware"
);

const Order = require("../models/Order");
const Worker = require("../models/Worker");
const Production = require("../models/Production");
const Mortality = require("../models/Mortality");

router.get(
  "/",
  auth,
  async (req, res) => {

    try {

      const orders =
        await Order.find();

      const workers =
        await Worker.find();

      const production =
        await Production.find();

      const mortality =
        await Mortality.find();

      res.json({
        orders,
        workers,
        production,
        mortality,
      });

    } catch (err) {

      res.status(500).json({
        error: err.message,
      });

    }
  }
);

module.exports = router;
