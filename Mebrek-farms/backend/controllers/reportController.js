const Production = require("../models/Production");

// =========================================
// Helper: parse & validate date range
// =========================================
const parseDateRange = (req) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return {
      error: "Both startDate and endDate query parameters are required",
    };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // include the whole end day

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { error: "startDate/endDate must be valid dates" };
  }

  return { start, end };
};

// Groups an array of records by their date (YYYY-MM-DD), for day-by-day
// chart series. `reduceFn` folds each record into that day's bucket.
const groupByDay = (records, reduceFn) => {
  const buckets = {};

  records.forEach((record) => {
    const key = new Date(record.date).toISOString().slice(0, 10);
    if (!buckets[key]) {
      buckets[key] = reduceFn(null, record, true);
    } else {
      buckets[key] = reduceFn(buckets[key], record, false);
    }
  });

  return Object.keys(buckets)
    .sort()
    .map((date) => ({ date, ...buckets[date] }));
};

// =========================================
// GET /api/reports/production
// =========================================
exports.getProductionReport = async (req, res) => {
  try {
    const { start, end, error } = parseDateRange(req);
    if (error) {
      return res.status(400).json({ error });
    }

    const records = await Production.find({
      date: { $gte: start, $lte: end },
      isDeleted: false,
    }).sort({ date: 1 });

    if (records.length === 0) {
      return res.json({
        summary: {
          totalRecords: 0,
          totalBirds: 0,
          totalEggs: 0,
          totalMortality: 0,
          averageProductionPercentage: 0,
          totalFeedConsumed: 0,
        },
        kpis: {
          totalEggs: 0,
          averageProductionPercentage: 0,
          highestProductionDay: null,
          lowestProductionDay: null,
          feedConsumed: 0,
          mortality: 0,
          openingBirds: 0,
          closingBirds: 0,
        },
        charts: {
          dailyEggProduction: [],
          feedConsumption: [],
          productionPercentage: [],
          mortalityTrend: [],
        },
        table: [],
      });
    }

    // ---------------- KPIs ----------------
    const totalEggs = records.reduce((sum, r) => sum + (r.totalEggs || 0), 0);
    const totalMortality = records.reduce(
      (sum, r) => sum + (r.mortality || 0),
      0,
    );
    const totalFeedConsumed = records.reduce(
      (sum, r) => sum + (r.feedBagsConsumed || 0),
      0,
    );
    const averageProductionPercentage =
      records.reduce((sum, r) => sum + (r.productionPercentage || 0), 0) /
      records.length;

    const highestProductionDay = records.reduce((best, r) =>
      (r.productionPercentage || 0) > (best.productionPercentage || 0)
        ? r
        : best,
    );
    const lowestProductionDay = records.reduce((worst, r) =>
      (r.productionPercentage || 0) < (worst.productionPercentage || 0)
        ? r
        : worst,
    );

    // Opening/closing birds: opening stock on the earliest date in range,
    // closing stock on the latest date in range, summed across all pens
    // active that day.
    const earliestDateKey = new Date(records[0].date)
      .toISOString()
      .slice(0, 10);
    const latestDateKey = new Date(records[records.length - 1].date)
      .toISOString()
      .slice(0, 10);

    const openingBirds = records
      .filter(
        (r) => new Date(r.date).toISOString().slice(0, 10) === earliestDateKey,
      )
      .reduce((sum, r) => sum + (r.openingStock || 0), 0);

    const closingBirds = records
      .filter(
        (r) => new Date(r.date).toISOString().slice(0, 10) === latestDateKey,
      )
      .reduce((sum, r) => sum + (r.closingStock || 0), 0);

    // ---------------- Charts (day-by-day, summed/averaged across pens) ----------------
    const dailyEggProduction = groupByDay(records, (acc, r, isFirst) => ({
      totalEggs: (isFirst ? 0 : acc.totalEggs) + (r.totalEggs || 0),
    }));

    const feedConsumption = groupByDay(records, (acc, r, isFirst) => ({
      feedBagsConsumed:
        (isFirst ? 0 : acc.feedBagsConsumed) + (r.feedBagsConsumed || 0),
    }));

    const mortalityTrend = groupByDay(records, (acc, r, isFirst) => ({
      mortality: (isFirst ? 0 : acc.mortality) + (r.mortality || 0),
    }));

    // Production % is an average across pens per day, so track a running
    // sum + count per day, then divide at the end.
    const productionPctBuckets = {};
    records.forEach((r) => {
      const key = new Date(r.date).toISOString().slice(0, 10);
      if (!productionPctBuckets[key]) {
        productionPctBuckets[key] = { sum: 0, count: 0 };
      }
      productionPctBuckets[key].sum += r.productionPercentage || 0;
      productionPctBuckets[key].count += 1;
    });
    const productionPercentageChart = Object.keys(productionPctBuckets)
      .sort()
      .map((date) => ({
        date,
        productionPercentage:
          productionPctBuckets[date].sum / productionPctBuckets[date].count,
      }));

    res.json({
      summary: {
        totalRecords: records.length,
        totalBirds: openingBirds,
        totalEggs,
        totalMortality,
        averageProductionPercentage,
        totalFeedConsumed,
      },
      kpis: {
        totalEggs,
        averageProductionPercentage,
        highestProductionDay: {
          date: highestProductionDay.date,
          pen: highestProductionDay.pen,
          productionPercentage: highestProductionDay.productionPercentage,
        },
        lowestProductionDay: {
          date: lowestProductionDay.date,
          pen: lowestProductionDay.pen,
          productionPercentage: lowestProductionDay.productionPercentage,
        },
        feedConsumed: totalFeedConsumed,
        mortality: totalMortality,
        openingBirds,
        closingBirds,
      },
      charts: {
        dailyEggProduction,
        feedConsumption,
        productionPercentage: productionPercentageChart,
        mortalityTrend,
      },
      table: records,
    });
  } catch (err) {
    console.error("Get Production Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// =========================================
// The remaining six reports are stubbed for now, pending their own
// build steps (Egg Sales, Feed Usage, Mortality, Vaccination,
// Warehouse, Staff) — each needs its own model verified first, same
// as we did for Production, rather than guessing field names.
// =========================================
exports.getEggSalesReport = async (req, res) => {
  res.status(501).json({ error: "Egg Sales report not implemented yet" });
};

exports.getFeedReport = async (req, res) => {
  res.status(501).json({ error: "Feed Usage report not implemented yet" });
};

exports.getMortalityReport = async (req, res) => {
  res.status(501).json({ error: "Mortality report not implemented yet" });
};

exports.getVaccinationReport = async (req, res) => {
  res.status(501).json({ error: "Vaccination report not implemented yet" });
};

exports.getWarehouseReport = async (req, res) => {
  res.status(501).json({ error: "Warehouse report not implemented yet" });
};

exports.getStaffReport = async (req, res) => {
  res.status(501).json({ error: "Staff report not implemented yet" });
};
