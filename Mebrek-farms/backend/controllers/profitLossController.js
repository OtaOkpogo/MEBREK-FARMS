const Expense = require("../models/Expense");
const EggSale = require("../models/EggSale");
const ManureSale = require("../models/ManureSale");
const Worker = require("../models/Worker");

const FARM_TIME_ZONE = "Africa/Lagos";

/**
 * Get calendar date parts using Nigerian farm time.
 */
const getFarmDateParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

/**
 * Create a UTC date representing a calendar boundary.
 * All report boundaries are calendar dates in Africa/Lagos.
 */
const calendarDateToUTC = (year, month, day) =>
  new Date(Date.UTC(year, month - 1, day));

/**
 * Define reporting periods.
 *
 * Daily: today.
 * Weekly: Sunday through Friday; Saturday excluded.
 * Monthly: current calendar month.
 * Yearly: current calendar year.
 */
const getReportingPeriods = () => {
  const { year, month, day } = getFarmDateParts();

  const today = calendarDateToUTC(year, month, day);
  const dayOfWeek = today.getUTCDay();

  const weekStart = calendarDateToUTC(year, month, day - dayOfWeek);

  // Saturday at 00:00 is the exclusive end boundary.
  const weekEnd = calendarDateToUTC(year, month, day - dayOfWeek + 6);

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

/**
 * Sum a numeric field for matching records.
 */
const sumField = async (Model, match, field) => {
  const result = await Model.aggregate([
    {
      $match: match,
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $ifNull: [`$${field}`, 0],
          },
        },
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  return {
    total: Number(result[0]?.total || 0),
    count: Number(result[0]?.count || 0),
  };
};

/**
 * Calculate the monthly salary equivalent of active workers.
 *
 * Monthly salary: salary amount.
 * Weekly salary: salary * 52 / 12.
 * Daily salary: salary * 26 working days.
 *
 * Workers with paymentFrequency "Other" are skipped because
 * their payment interval cannot be determined safely.
 *
 * This estimates salary cost from current worker records.
 * It does not verify actual salary payments or historical
 * salary changes during the reporting period.
 */
const getMonthlySalaryCost = async () => {
  const workers = await Worker.find({
    status: "Active",
    isDeleted: { $ne: true },
  }).select("salary paymentFrequency");

  let total = 0;
  let workerCount = 0;

  for (const worker of workers) {
    const salary = Number(worker.salary || 0);

    if (!Number.isFinite(salary) || salary <= 0) {
      continue;
    }

    const frequency = String(worker.paymentFrequency || "Monthly")
      .trim()
      .toLowerCase();

    let monthlyEquivalent = 0;

    if (frequency === "monthly") {
      monthlyEquivalent = salary;
    } else if (frequency === "weekly") {
      monthlyEquivalent = salary * (52 / 12);
    } else if (frequency === "daily") {
      monthlyEquivalent = salary * 26;
    } else {
      // Do not guess an unknown payment frequency.
      continue;
    }

    total += monthlyEquivalent;
    workerCount += 1;
  }

  return {
    total: Number(total.toFixed(2)),
    count: workerCount,
  };
};

/**
 * Calculate a report for a selected date range.
 *
 * All recorded expenses come from the Expense collection.
 * FeedInvoice is deliberately not included, preventing
 * duplicate feed purchases or transport charges.
 *
 * Salary estimates are added only to monthly and yearly
 * reports. A yearly report uses 12 monthly equivalents.
 */
const calculatePeriod = async (start, end, options = {}) => {
  const salaryMonths = Number(options.salaryMonths || 0);

  const dateMatch = {
    date: {
      $gte: start,
      $lt: end,
    },
    isDeleted: {
      $ne: true,
    },
  };

  const [eggSales, manureSales, expenseRecords, monthlySalaryResult] =
    await Promise.all([
      sumField(EggSale, dateMatch, "totalAmount"),

      sumField(ManureSale, dateMatch, "totalAmount"),

      // Include every Expense category:
      // Feed, Drugs, Labour, Fuel, Repairs, Utilities,
      // Transport, and Other.
      sumField(Expense, dateMatch, "amount"),

      salaryMonths > 0
        ? getMonthlySalaryCost()
        : Promise.resolve({
            total: 0,
            count: 0,
          }),
    ]);

  const eggIncome = eggSales.total;
  const manureIncome = manureSales.total;
  const totalIncome = eggIncome + manureIncome;

  const recordedExpenses = expenseRecords.total;

  const monthlySalaryCost = monthlySalaryResult.total;

  const staffSalaryCost = monthlySalaryCost * salaryMonths;

  const totalExpenses = recordedExpenses + staffSalaryCost;

  const netProfit = totalIncome - totalExpenses;

  return {
    startDate: start.toISOString().slice(0, 10),

    // Exclusive end boundary; the actual final included day
    // is the calendar day immediately before this date.
    endDateExclusive: end.toISOString().slice(0, 10),

    income: {
      eggSales: eggIncome,
      manureSales: manureIncome,
      totalIncome,
    },

    expenses: {
      recordedExpenses,
      staffSalaries: Number(staffSalaryCost.toFixed(2)),
      totalExpenses,
    },

    netProfit,

    result: netProfit > 0 ? "Profit" : netProfit < 0 ? "Loss" : "Break-even",

    records: {
      eggSales: eggSales.count,
      manureSales: manureSales.count,
      expenseRecords: expenseRecords.count,
      staffIncludedInSalaryEstimate: monthlySalaryResult.count,
    },

    salaryDetails: {
      monthlySalaryEstimate: monthlySalaryCost,
      monthsIncluded: salaryMonths,
      salaryEstimateForPeriod: Number(staffSalaryCost.toFixed(2)),
    },
  };
};

/**
 * GET /api/reports/profitloss
 *
 * Access is restricted to superadmin in reportRoutes.js.
 *
 * Supported query parameters:
 * ?period=daily
 * ?period=weekly
 * ?period=monthly
 * ?period=yearly
 *
 * Without a period, all four reports are returned.
 */
exports.getProfitLossReport = async (req, res) => {
  try {
    const periods = getReportingPeriods();

    const periodNames = ["daily", "weekly", "monthly", "yearly"];

    const requestedPeriod = String(req.query.period || "")
      .trim()
      .toLowerCase();

    if (requestedPeriod && !periodNames.includes(requestedPeriod)) {
      return res.status(400).json({
        message: "Invalid period. Use daily, weekly, monthly, or yearly.",
      });
    }

    const namesToCalculate = requestedPeriod ? [requestedPeriod] : periodNames;

    const results = await Promise.all(
      namesToCalculate.map(async (name) => {
        let salaryMonths = 0;

        if (name === "monthly") {
          salaryMonths = 1;
        } else if (name === "yearly") {
          salaryMonths = 12;
        }

        const report = await calculatePeriod(
          periods[name].start,
          periods[name].end,
          { salaryMonths },
        );

        return [name, report];
      }),
    );

    return res.status(200).json({
      success: true,
      currency: "NGN",
      timezone: FARM_TIME_ZONE,

      weekDefinition: "Sunday through Friday; Saturday excluded.",

      expenseSource:
        "All expense totals are calculated from the Expense collection. Feed invoices are not added separately.",

      salaryBasis:
        "Monthly reports include one estimated month of salary costs. Yearly reports include twelve estimated monthly equivalents. Daily and weekly reports exclude salary estimates.",

      salaryWarning:
        "Salary figures are estimates based on current active worker salary records and payment frequencies. They do not represent verified payments or historical salary changes.",

      incomeBasis:
        "Recorded egg sales and manure sales, based on their recorded dates.",

      periods: Object.fromEntries(results),

      selectedPeriod: requestedPeriod || "all",
    });
  } catch (error) {
    console.error("PROFIT AND LOSS REPORT ERROR:", error);

    return res.status(500).json({
      message: "Failed to generate profit and loss report.",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
