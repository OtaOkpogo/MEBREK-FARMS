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

        const productions = await Production.find(filter).sort({
          date: -1,
        });

        // ==========================
        // SUMMARY
        // ==========================

        const totalProduction = productions.reduce(
          (sum, item) => sum + (item.totalEggs || 0),
          0,
        );

        const totalCrates = productions.reduce(
          (sum, item) => sum + (item.cratesProduced || 0),
          0,
        );

        const totalFeedConsumed = productions.reduce(
          (sum, item) => sum + (item.feedBagsConsumed || 0),
          0,
        );

        const totalMortality = productions.reduce(
          (sum, item) => sum + (item.mortality || 0),
          0,
        );

        const averageProduction =
          productions.length > 0
            ? Number((totalProduction / productions.length).toFixed(2))
            : 0;

        // ==========================
        // CHART DATA
        // ==========================

        const chartData = productions.map((item) => ({
          name: new Date(item.date).toLocaleDateString(),
          value: item.totalEggs || 0,
        }));

        // ==========================
        // TABLE DATA
        // ==========================

        const tableData = productions.map((item) => ({
          Date: item.date,
          Pen: item.pen,
          OpeningStock: item.openingStock,
          ClosingStock: item.closingStock,
          Mortality: item.mortality,
          FeedConsumed: item.feedBagsConsumed,
          CratesProduced: item.cratesProduced,
          TotalEggs: item.totalEggs,
          ProductionPercentage: item.productionPercentage,
        }));

        report = {
          summary: {
            totalProduction,
            totalCrates,
            totalFeedConsumed,
            totalMortality,
            averageProduction,
          },
          chartData,
          tableData,
        };

        break;
      }

      // =====================================
      // EGG SALES REPORT
      // =====================================
      case "eggsales": {
        const filter = buildDateFilter(req, "date");

        const sales = await EggSale.find(filter).sort({
          date: -1,
        });

        // ==========================
        // SUMMARY
        // ==========================

        const totalRevenue = sales.reduce(
          (sum, sale) => sum + (sale.grandTotal || 0),
          0,
        );

        const totalPaid = sales.reduce(
          (sum, sale) => sum + (sale.amountPaid || 0),
          0,
        );

        const totalOutstanding = sales.reduce(
          (sum, sale) => sum + (sale.balance || 0),
          0,
        );

        const totalCrates = sales.reduce(
          (sum, sale) => sum + (sale.cratesSold || 0),
          0,
        );

        const totalLooseEggs = sales.reduce(
          (sum, sale) => sum + (sale.looseEggs || 0),
          0,
        );

        // ==========================
        // CHART DATA
        // ==========================

        const chartData = sales.map((sale) => ({
          name: sale.customer,
          value: sale.grandTotal || 0,
        }));

        // ==========================
        // TABLE DATA
        // ==========================

        const tableData = sales.map((sale) => ({
          Date: sale.date,
          Customer: sale.customer,
          Phone: sale.phone,
          CratesSold: sale.cratesSold,
          LooseEggs: sale.looseEggs,
          GrandTotal: sale.grandTotal,
          AmountPaid: sale.amountPaid,
          Balance: sale.balance,
          PaymentMethod: sale.paymentMethod,
        }));

        report = {
          summary: {
            totalRevenue,
            totalPaid,
            totalOutstanding,
            totalCrates,
            totalLooseEggs,
          },
          chartData,
          tableData,
        };

        break;
      }
      // =====================================
      // FEED USAGE REPORT
      // =====================================
      case "feedusage": {
        // Current inventory (always current, not date filtered)
        const inventory = await Feed.find({
          isDeleted: false,
        }).sort({ name: 1 });

        // Feed usage comes from Production records
        const productionFilter = applyPenFilter(
          req,
          buildDateFilter(req, "date"),
        );

        const productions = await Production.find(productionFilter);

        // ==========================
        // SUMMARY
        // ==========================

        const currentStock = inventory.reduce(
          (sum, item) => sum + (item.quantity || 0),
          0,
        );

        const inventoryValue = inventory.reduce(
          (sum, item) => sum + (item.quantity || 0) * (item.pricePerUnit || 0),
          0,
        );

        const lowStockItems = inventory.filter(
          (item) => item.quantity <= item.lowStockThreshold,
        ).length;

        const feedTypes = inventory.length;

        const feedUsed = productions.reduce(
          (sum, item) => sum + (item.feedBagsConsumed || 0),
          0,
        );

        const averageDailyUsage =
          productions.length > 0
            ? Number((feedUsed / productions.length).toFixed(2))
            : 0;

        // ==========================
        // CHART DATA
        // ==========================

        const chartData = inventory.map((item) => ({
          name: item.name,
          value: item.quantity,
        }));

        // ==========================
        // TABLE DATA
        // ==========================

        const tableData = inventory.map((item) => ({
          Feed: item.name,
          Supplier: item.supplier || "-",
          Quantity: item.quantity,
          Unit: item.unit,
          PricePerUnit: item.pricePerUnit,
          StockValue: item.quantity * item.pricePerUnit,
          Status:
            item.quantity <= item.lowStockThreshold ? "Low Stock" : "In Stock",
        }));

        report = {
          summary: {
            currentStock,
            inventoryValue,
            feedUsed,
            averageDailyUsage,
            lowStockItems,
            feedTypes,
          },
          chartData,
          tableData,
        };

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
