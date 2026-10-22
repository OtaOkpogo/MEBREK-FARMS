
const Expense = require("../models/Expense");
const EggSale = require("../models/EggSale");
const ManureSale = require("../models/ManureSale");
const FeedInvoice = require("../models/FeedInvoice");

const FARM_TIME_ZONE = "Africa/Lagos";

const getFarmDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

const calendarDateToUTC = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day));

const getReportingPeriods = () => {
  const { year, month, day } = getFarmDateParts();

  const today = calendarDateToUTC(year, month, day);
  const dayOfWeek = today.getUTCDay();

  // Farm week runs Sunday through Friday.
  // Saturday at 00:00 is the exclusive end boundary.
  const weekStart = calendarDateToUTC(
    year,
    month,
    day - dayOfWeek,
  );

  const weekEnd = calendarDateToUTC(
    year,
    month,
    day - dayOfWeek + 6,
  );

  return {
    daily: {
      start: today,
      end: calendarDateToUTC(year, month, day + 1),
    },

    weekly: {
      start: weekStart,
      end: weekEnd,
    },

    monthly: {
      start: calendarDateToUTC(year, month, 1),
      end: calendarDateToUTC(year, month + 1, 1),
    },

    yearly: {
      start: calendarDateToUTC(year, 1, 1),
      end: calendarDateToUTC(year + 1, 1, 1),
    },
  };
};

const sumField = async (Model, match, field) => {
  const result = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: { $ifNull: [`$${field}`, 0] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  return {
    total: Number(result[0]?.total || 0),
    count: Number(result[0]?.count || 0),
  };
};

const calculatePeriod = async (start, end) => {
  const dateMatch = {
    date: { $gte: start, $lt: end },
    isDeleted: { $ne: true },
  };

  const invoiceDateMatch = {
    purchaseDate: { $gte: start, $lt: end },
    isDeleted: { $ne: true },
    invoiceStatus: { $ne: "Cancelled" },
  };

  const [
    eggSales,
    manureSales,
    otherExpenses,
    feedInvoices,
  ] = await Promise.all([
    sumField(EggSale, dateMatch, "totalAmount"),

    sumField(ManureSale, dateMatch, "totalAmount"),

    // Feed invoices are counted separately below.
    // Excluding Expense category "Feed" helps avoid double-counting
    // the same feed purchase if it was also entered as an expense.
    (async () => {
      const result = await Expense.aggregate([
        {
          $match: {
            ...dateMatch,
            category: { $ne: "Feed" },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $ifNull: ["$amount", 0] },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        total: Number(result[0]?.total || 0),
        count: Number(result[0]?.count || 0),
      };
    })(),

    (async () => {
      const result = await FeedInvoice.aggregate([
        { $match: invoiceDateMatch },
        {
          $group: {
            _id: null,
            purchaseCost: {
              $sum: { $ifNull: ["$totalCost", 0] },
            },
            transportCost: {
              $sum: { $ifNull: ["$transportCost", 0] },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      const row = result[0] || {};

      return {
        purchaseCost: Number(row.purchaseCost || 0),
        transportCost: Number(row.transportCost || 0),
        count: Number(row.count || 0),
        total:
          Number(row.purchaseCost || 0) +
          Number(row.transportCost || 0),
      };
    })(),
  ]);

  const eggIncome = eggSales.total;
  const manureIncome = manureSales.total;
  const totalIncome = eggIncome + manureIncome;

  const feedPurchaseCost = feedInvoices.total;
  const otherOperatingExpenses = otherExpenses.total;
  const totalExpenses = feedPurchaseCost + otherOperatingExpenses;

  const netProfit = totalIncome - totalExpenses;

  return {
    startDate: start.toISOString().slice(0, 10),
    endDateExclusive: end.toISOString().slice(0, 10),

    income: {
      eggSales: eggIncome,
      manureSales: manureIncome,
      totalIncome,
    },

    expenses: {
      feedPurchases: feedPurchaseCost,
      feedTransport: feedInvoices.transportCost,
      otherOperatingExpenses,
      totalExpenses,
    },

    netProfit,
    result: netProfit > 0
      ? "Profit"
      : netProfit < 0
        ? "Loss"
        : "Break-even",

    records: {
      eggSales: eggSales.count,
      manureSales: manureSales.count,
      feedInvoices: feedInvoices.count,
      otherExpenses: otherExpenses.count,
    },
  };
};

// GET /api/reports/profitloss
// Superadmin access is enforced in reportRoutes.js.
exports.getProfitLossReport = async (req, res) => {
  try {
    const periods = getReportingPeriods();

    const periodNames = ["daily", "weekly", "monthly", "yearly"];

    const requestedPeriod = String(req.query.period || "").toLowerCase();

    if (
      requestedPeriod &&
      !periodNames.includes(requestedPeriod)
    ) {
      return res.status(400).json({
        message:
          "Invalid period. Use daily, weekly, monthly, or yearly.",
      });
    }

    const namesToCalculate = requestedPeriod
      ? [requestedPeriod]
      : periodNames;

    const results = await Promise.all(
      namesToCalculate.map(async (name) => [
        name,
        await calculatePeriod(
          periods[name].start,
          periods[name].end,
        ),
      ]),
    );

    const summary = Object.fromEntries(results);

    return res.status(200).json({
      success: true,
      currency: "NGN",
      timezone: FARM_TIME_ZONE,
      weekDefinition: "Sunday through Friday; Saturday excluded",
      basis:
        "Recorded egg and manure sales minus recorded expenses and feed invoices",
      periods: summary,
      selectedPeriod: requestedPeriod || "all",
    });
  } catch (error) {
    console.error("PROFIT AND LOSS REPORT ERROR:", error);

    return res.status(500).json({
      message: "Failed to generate profit and loss report.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

