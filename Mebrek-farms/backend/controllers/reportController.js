const Production = require("../models/Production");
const EggSale = require("../models/EggSale");
const Feed = require("../models/Feed");
const Mortality = require("../models/Mortality");
const Vaccination = require("../models/Vaccination");
const Warehouse = require("../models/Warehouse");
const Admin = require("../models/Admin");

// =========================================
// Helper: Build Date Filter
// =========================================
const buildDateFilter = (req, field = "date") => {
  const { startDate, endDate } = req.query;

  const filter = {};

  if (startDate || endDate) {
    filter[field] = {};

    if (startDate) {
      filter[field].$gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter[field].$lte = end;
    }
  }

  return filter;
};

// =========================================
// Helper: Apply Pen Filter
// =========================================
const applyPenFilter = (req, filter = {}) => {
  if (req.query.pen && req.query.pen !== "All") {
    filter.pen = req.query.pen;
  }

  return filter;
};

// =========================================
// GET REPORT
// =========================================
exports.getReport = async (req, res) => {
  try {
    const { type } = req.params;

    let report = [];

    switch (type) {
      // =====================================
      // PRODUCTION REPORT
      // =====================================
      case "production": {
        const filter = applyPenFilter(req, buildDateFilter(req, "date"));

        report = await Production.find(filter).sort({ date: -1 });

        break;
      }

      // =====================================
      // EGG SALES REPORT
      // =====================================
      case "eggsales": {
        const filter = buildDateFilter(req, "date");

        report = await EggSale.find(filter).sort({ date: -1 });

        break;
      }
      // =====================================
      // FEED USAGE REPORT
      // =====================================
      case "feedusage": {
        const filter = buildDateFilter(req, "date");

        report = await Feed.find(filter).sort({ date: -1 });
        break;
      }

      // =====================================
      // MORTALITY REPORT
      // =====================================
      case "mortality": {
        const filter = applyPenFilter(req, buildDateFilter(req, "date"));

        report = await Mortality.find(filter).sort({ date: -1 });

        break;
      }
      // =====================================
      // VACCINATION REPORT
      // =====================================
      case "vaccination": {
        const filter = applyPenFilter(
          req,
          buildDateFilter(req, "vaccinationDate"),
        );

        report = await Vaccination.find(filter).sort({ vaccinationDate: -1 });

        break;
      }

      // =====================================
      // WAREHOUSE REPORT
      // =====================================
      case "warehouse": {
        report = await Warehouse.find().sort({ category: 1, itemName: 1 });

        break;
      }
      // =====================================
      // STAFF REPORT
      // =====================================
      case "staff": {
        report = await Admin.find().select("-password").sort({ name: 1 });

        break;
      }

      // =====================================
      // INVALID REPORT TYPE
      // =====================================
      default:
        return res.status(400).json({
          error: "Invalid report type",
        });
    }

    res.json(report);
  } catch (err) {
    console.error("REPORT ERROR:", err);

    res.status(500).json({
      error: "Failed to generate report",
      message: err.message,
    });
  }
};
