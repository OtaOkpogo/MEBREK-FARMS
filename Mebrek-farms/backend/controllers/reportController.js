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
        // isDeleted: false — soft-deleted production entries were
        // previously being counted into report totals because this
        // filter never excluded them, unlike other modules.
        const filter = applyPenFilter(req, {
          ...buildDateFilter(req, "date"),
          isDeleted: false,
        });

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

        // NOTE: keys here (totalEggs, feedConsumed) must match what
        // Reports.jsx reads off `summary` for the Production card set.
        // The underlying values are still totalProduction/totalFeedConsumed
        // internally — only the outgoing key names changed.
        report = {
          summary: {
            totalEggs: totalProduction,
            totalCrates,
            feedConsumed: totalFeedConsumed,
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
        const filter = {
          ...buildDateFilter(req, "date"),
          isDeleted: false,
        };

        const sales = await EggSale.find(filter).sort({
          date: -1,
        });

        // ==========================
        // SUMMARY
        // ==========================
        // EggSale no longer has flat grandTotal/cratesSold/looseEggs
        // fields — those moved into totalAmount and a per-category
        // lineItems[] array when multi-category sales were added.

        const totalRevenue = sales.reduce(
          (sum, sale) => sum + (sale.totalAmount || 0),
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
          (sum, sale) =>
            sum +
            (sale.lineItems || []).reduce(
              (itemSum, item) => itemSum + (item.cratesSold || 0),
              0,
            ),
          0,
        );

        const totalLooseEggs = sales.reduce(
          (sum, sale) =>
            sum +
            (sale.lineItems || []).reduce(
              (itemSum, item) => itemSum + (item.looseEggs || 0),
              0,
            ),
          0,
        );

        // ==========================
        // CHART DATA
        // ==========================

        const chartData = sales.map((sale) => ({
          name: sale.customer,
          value: sale.totalAmount || 0,
        }));

        // ==========================
        // TABLE DATA
        // ==========================

        const tableData = sales.map((sale) => ({
          Date: sale.date,
          Customer: sale.customer,
          Phone: sale.phone,
          Categories: (sale.lineItems || [])
            .map((item) => `${item.category} (${item.cratesSold || 0}c)`)
            .join(", "),
          GrandTotal: sale.totalAmount,
          AmountPaid: sale.amountPaid,
          Balance: sale.balance,
          PaymentMethod: sale.paymentMethod,
        }));

        report = {
          summary: {
            revenue: totalRevenue,
            amountPaid: totalPaid,
            outstanding: totalOutstanding,
            cratesSold: totalCrates,
            looseEggsSold: totalLooseEggs,
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
        const productionFilter = applyPenFilter(req, {
          ...buildDateFilter(req, "date"),
          isDeleted: false,
        });

        const productions = await Production.find(productionFilter).sort({
          date: 1,
        });

        // Feed purchased in the selected date range — filtered on the
        // Feed model's own purchaseDate, separate from currentStock
        // (which is always "right now" regardless of date range).
        const purchaseFilter = {
          ...buildDateFilter(req, "purchaseDate"),
          isDeleted: false,
        };

        const purchasedFeeds = await Feed.find(purchaseFilter);

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

        const feedPurchased = purchasedFeeds.reduce(
          (sum, item) => sum + (item.quantity || 0),
          0,
        );

        const averageDailyUsage =
          productions.length > 0
            ? Number((feedUsed / productions.length).toFixed(2))
            : 0;

        // ==========================
        // CHART DATA
        // ==========================
        // Daily feed consumption, built from the same `productions`
        // records used for feedUsed above — one point per calendar
        // date, summing feedBagsConsumed in case multiple pens logged
        // feed use on the same day. This gives Bar/Line/Pie a real
        // time series instead of a one-off snapshot of current stock
        // per feed type, which couldn't render a meaningful trend
        // line with only one feed type in inventory.
        const byDate = {};
        productions.forEach((item) => {
          const label = item.date
            ? new Date(item.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "Unknown";
          byDate[label] = (byDate[label] || 0) + (item.feedBagsConsumed || 0);
        });

        const chartData = Object.entries(byDate).map(([name, value]) => ({
          name,
          value,
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
          PurchaseDate: item.purchaseDate,
          ExpiryDate: item.expiryDate,
          Status:
            item.quantity <= item.lowStockThreshold ? "Low Stock" : "In Stock",
        }));

        // NOTE: keys here (stock, lowStock, feedPurchased) must match
        // what Reports.jsx reads off `summary` for the Feed Usage card
        // set — the underlying values keep their descriptive internal
        // names above, only the outgoing key names changed.
        report = {
          summary: {
            feedPurchased,
            feedUsed,
            stock: currentStock,
            lowStock: lowStockItems,
            inventoryValue,
            averageDailyUsage,
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

        const records = await Mortality.find(filter).sort({ date: -1 });

        // ==========================
        // SUMMARY
        // ==========================

        const totalDeaths = records.reduce(
          (sum, item) => sum + (item.numberDead || 0),
          0,
        );

        const totalLoss = records.reduce(
          (sum, item) => sum + (item.estimatedLoss || 0),
          0,
        );

        const recordCount = records.length;

        const averageLossPerRecord =
          recordCount > 0 ? Number((totalLoss / recordCount).toFixed(2)) : 0;

        // ==========================
        // CHART DATA
        // ==========================
        // Deaths grouped by cause, mirroring the pie/bar breakdown on
        // the Mortality entry page itself.

        const byCause = {};
        records.forEach((item) => {
          const cause = item.cause || "Unknown";
          byCause[cause] = (byCause[cause] || 0) + (item.numberDead || 0);
        });

        const chartData = Object.entries(byCause).map(([name, value]) => ({
          name,
          value,
        }));

        // ==========================
        // TABLE DATA
        // ==========================

        const tableData = records.map((item) => ({
          Date: item.date,
          Pen: item.birdBatch,
          Deaths: item.numberDead,
          Cause: item.cause,
          EstimatedLoss: item.estimatedLoss,
          Notes: item.notes || "-",
        }));

        report = {
          summary: {
            totalDeaths,
            totalLoss,
            recordCount,
            averageLossPerRecord,
          },
          chartData,
          tableData,
        };

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
