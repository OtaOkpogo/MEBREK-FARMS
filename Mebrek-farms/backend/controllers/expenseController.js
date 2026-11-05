const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Counter = require("../models/Counter");
const Worker = require("../models/Worker");
const WorkerMonthlySalary = require("../models/WorkerMonthlySalary");

const ALLOWED_CATEGORIES = [
  "Feed",
  "Drugs",
  "Labour",
  "Salaries",
  "Fuel",
  "Repairs",
  "Utilities",
  "Transport",
  "Other",
];

const ALLOWED_PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

const ALLOWED_EXPENSE_TYPES = ["General", "Salary"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const roundMoney = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const isValidSalaryPeriod = (period) =>
  typeof period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(period);

const getAdminInfo = (req) => {
  const admin = req.admin || req.user || {};

  return {
    adminId: admin._id || admin.id || null,
    adminName:
      admin.name ||
      admin.adminName ||
      admin.fullName ||
      admin.email ||
      "Administrator",
  };
};

const getWorkerName = (worker) =>
  `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
  worker.name ||
  "Unknown Worker";

const getEmployeeId = (worker) => worker.employeeId || worker.staffId || "";

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const validatePaymentDate = (value) => {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Please provide a valid payment date.");
  }

  return date;
};

const validatePaymentMethod = (paymentMethod) => {
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error(
      `Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(", ")}.`,
    );
  }
};

const validatePositiveAmount = (value, label = "Amount") => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return roundMoney(amount);
};

const validateNonNegativeAmount = (value, label = "Amount") => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return roundMoney(amount);
};

const getActiveExpenseQuery = () => ({ isDeleted: { $ne: true } });

const getExpenseDateFilter = (query = {}) => {
  const filter = {};

  if (query.startDate || query.from) {
    const start = new Date(query.startDate || query.from);

    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      filter.$gte = start;
    }
  }

  if (query.endDate || query.to) {
    const end = new Date(query.endDate || query.to);

    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      filter.$lte = end;
    }
  }

  return Object.keys(filter).length ? filter : null;
};

const buildExpenseFilter = (query = {}, includeDeleted = false) => {
  const filter = {};

  if (includeDeleted) {
    filter.isDeleted = true;
  } else {
    filter.isDeleted = { $ne: true };
  }

  const dateFilter = getExpenseDateFilter(query);

  if (dateFilter) {
    filter.date = dateFilter;
  }

  if (query.category && query.category !== "All") {
    filter.category = query.category;
  }

  if (query.expenseType && query.expenseType !== "All") {
    filter.expenseType = query.expenseType;
  }

  if (query.paymentMethod && query.paymentMethod !== "All") {
    filter.paymentMethod = query.paymentMethod;
  }

  if (query.workerId && isValidObjectId(query.workerId)) {
    filter.worker = query.workerId;
  }

  if (query.salaryPeriod && isValidSalaryPeriod(query.salaryPeriod)) {
    filter.salaryPeriod = query.salaryPeriod;
  }

  if (query.search) {
    const search = new RegExp(escapeRegex(query.search.trim()), "i");

    filter.$or = [
      { expenseNumber: search },
      { description: search },
      { category: search },
      { supplier: search },
      { remarks: search },
      { workerName: search },
      { employeeId: search },
    ];
  }

  return filter;
};

const generateExpenseNumber = async () => {
  const year = new Date().getFullYear();

  const counter = await Counter.findOneAndUpdate(
    { _id: `expense-${year}` },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return `EXP-${year}-${String(counter.seq).padStart(6, "0")}`;
};

const getActiveWorker = async (workerId) => {
  if (!workerId || !isValidObjectId(workerId)) {
    throw new Error("Please select a valid worker.");
  }

  const worker = await Worker.findOne({
    _id: workerId,
    status: "Active",
  });

  if (!worker) {
    throw new Error("Worker not found or is not active.");
  }

  return worker;
};

const getSalaryRecord = async (workerId, salaryPeriod) =>
  WorkerMonthlySalary.findOne({
    worker: workerId,
    salaryPeriod,
  });

const getPaidToDate = async (
  workerId,
  salaryPeriod,
  excludeExpenseId = null,
) => {
  const match = {
    worker: new mongoose.Types.ObjectId(String(workerId)),
    salaryPeriod,
    expenseType: "Salary",
    isDeleted: { $ne: true },
  };

  if (excludeExpenseId && isValidObjectId(excludeExpenseId)) {
    match._id = { $ne: new mongoose.Types.ObjectId(String(excludeExpenseId)) };
  }

  const result = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: "$amount" },
      },
    },
  ]);

  return roundMoney(result[0]?.total || 0);
};

const createSalaryPaymentRecord = async ({
  workerId,
  salaryPeriod,
  amount,
  date,
  paymentMethod,
  remarks,
  payrollBatchId,
  adminId,
  adminName,
}) => {
  if (!isValidSalaryPeriod(salaryPeriod)) {
    throw new Error("Select a valid salary month in YYYY-MM format.");
  }

  const paymentAmount = validatePositiveAmount(amount, "Payment amount");

  validatePaymentMethod(paymentMethod);

  const paymentDate = validatePaymentDate(date);
  const worker = await getActiveWorker(workerId);

  const salaryRecord = await getSalaryRecord(worker._id, salaryPeriod);

  if (!salaryRecord) {
    throw new Error(
      `Set the agreed monthly salary for ${getWorkerName(worker)} for ${salaryPeriod} before recording a payment.`,
    );
  }

  const agreedSalary = roundMoney(salaryRecord.salaryAmount);
  const paidToDate = await getPaidToDate(worker._id, salaryPeriod);
  const outstanding = roundMoney(Math.max(0, agreedSalary - paidToDate));

  if (outstanding <= 0) {
    throw new Error(
      `${getWorkerName(worker)} has already been fully paid for ${salaryPeriod}.`,
    );
  }

  if (paymentAmount > outstanding) {
    throw new Error(
      `Payment exceeds the outstanding balance of ₦${outstanding.toLocaleString(
        "en-NG",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )}.`,
    );
  }

  const expenseNumber = await generateExpenseNumber();

  const expense = await Expense.create({
    expenseNumber,
    expenseType: "Salary",
    date: paymentDate,
    category: "Salaries",
    description: `Monthly salary payment - ${getWorkerName(worker)} (${salaryPeriod})`,
    quantity: 1,
    unitCost: paymentAmount,
    amount: paymentAmount,
    supplier: getWorkerName(worker),
    paymentMethod,
    remarks: remarks || "",
    worker: worker._id,
    workerName: getWorkerName(worker),
    employeeId: getEmployeeId(worker),
    salaryPeriod,
    salaryAmount: agreedSalary,
    payrollBatchId: payrollBatchId || undefined,
    createdBy: adminId || undefined,
    createdByName: adminName || "Administrator",
  });

  return expense;
};

// ============================================================
// CREATE GENERAL EXPENSE
// ============================================================

exports.createExpense = async (req, res) => {
  try {
    const {
      date,
      category,
      description,
      quantity,
      unitCost,
      amount,
      supplier,
      paymentMethod,
      remarks,
    } = req.body;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        message: "Please provide a valid expense date.",
      });
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({
        message: `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}.`,
      });
    }

    if (!description || !String(description).trim()) {
      return res.status(400).json({
        message: "Expense description is required.",
      });
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        message: `Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(", ")}.`,
      });
    }

    const safeQuantity =
      quantity === undefined || quantity === null || quantity === ""
        ? 1
        : Number(quantity);

    const safeUnitCost =
      unitCost === undefined || unitCost === null || unitCost === ""
        ? null
        : Number(unitCost);

    let finalAmount;

    if (amount !== undefined && amount !== null && amount !== "") {
      finalAmount = validateNonNegativeAmount(amount);
    } else if (
      Number.isFinite(safeQuantity) &&
      safeQuantity >= 0 &&
      Number.isFinite(safeUnitCost) &&
      safeUnitCost >= 0
    ) {
      finalAmount = roundMoney(safeQuantity * safeUnitCost);
    } else {
      return res.status(400).json({
        message:
          "Provide a valid expense amount or valid quantity and unit cost.",
      });
    }

    if (!Number.isFinite(safeQuantity) || safeQuantity < 0) {
      return res.status(400).json({
        message: "Quantity cannot be negative.",
      });
    }

    const admin = getAdminInfo(req);
    const expenseNumber = await generateExpenseNumber();

    const expense = await Expense.create({
      expenseNumber,
      expenseType: "General",
      date: new Date(date),
      category,
      description: String(description).trim(),
      quantity: safeQuantity,
      unitCost:
        Number.isFinite(safeUnitCost) && safeUnitCost >= 0
          ? safeUnitCost
          : finalAmount,
      amount: finalAmount,
      supplier: supplier || "",
      paymentMethod,
      remarks: remarks || "",
      createdBy: admin.adminId || undefined,
      createdByName: admin.adminName,
    });

    return res.status(201).json({
      message: "Expense created successfully.",
      expense,
    });
  } catch (error) {
    console.error("Create expense error:", error);

    return res.status(400).json({
      message: error.message || "Failed to create expense.",
    });
  }
};

// ============================================================
// GET EXPENSES
// ============================================================

exports.getExpenses = async (req, res) => {
  try {
    const filter = buildExpenseFilter(req.query, false);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("worker", "firstName lastName employeeId status")
        .lean(),
      Expense.countDocuments(filter),
    ]);

    return res.status(200).json({
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get expenses error:", error);

    return res.status(500).json({
      message: "Failed to fetch expenses.",
    });
  }
};

// ============================================================
// GET DELETED EXPENSES
// ============================================================

exports.getDeletedExpenses = async (req, res) => {
  try {
    const filter = buildExpenseFilter(req.query, true);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ deletedAt: -1, date: -1 })
        .skip(skip)
        .limit(limit)
        .populate("worker", "firstName lastName employeeId status")
        .lean(),
      Expense.countDocuments(filter),
    ]);

    return res.status(200).json({
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get deleted expenses error:", error);

    return res.status(500).json({
      message: "Failed to fetch deleted expenses.",
    });
  }
};

// ============================================================
// UPDATE GENERAL EXPENSE
// ============================================================

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found.",
      });
    }

    if (expense.expenseType === "Salary") {
      return res.status(400).json({
        message:
          "Payroll payment records cannot be edited as general expenses. Record a separate payment or use the appropriate payroll workflow.",
      });
    }

    const {
      date,
      category,
      description,
      quantity,
      unitCost,
      amount,
      supplier,
      paymentMethod,
      remarks,
    } = req.body;

    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({
          message: "Please provide a valid expense date.",
        });
      }
      expense.date = new Date(date);
    }

    if (category !== undefined) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({
          message: `Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}.`,
        });
      }
      expense.category = category;
    }

    if (description !== undefined) {
      if (!String(description).trim()) {
        return res.status(400).json({
          message: "Expense description is required.",
        });
      }
      expense.description = String(description).trim();
    }

    if (quantity !== undefined) {
      const parsedQuantity = Number(quantity);

      if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
        return res.status(400).json({
          message: "Quantity cannot be negative.",
        });
      }

      expense.quantity = parsedQuantity;
    }

    if (unitCost !== undefined) {
      const parsedUnitCost = Number(unitCost);

      if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
        return res.status(400).json({
          message: "Unit cost cannot be negative.",
        });
      }

      expense.unitCost = roundMoney(parsedUnitCost);
    }

    if (amount !== undefined) {
      expense.amount = validateNonNegativeAmount(amount);
    } else if (quantity !== undefined || unitCost !== undefined) {
      expense.amount = roundMoney(
        Number(expense.quantity || 0) * Number(expense.unitCost || 0),
      );
    }

    if (supplier !== undefined) {
      expense.supplier = supplier;
    }

    if (paymentMethod !== undefined) {
      if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
        return res.status(400).json({
          message: `Payment method must be one of: ${ALLOWED_PAYMENT_METHODS.join(", ")}.`,
        });
      }
      expense.paymentMethod = paymentMethod;
    }

    if (remarks !== undefined) {
      expense.remarks = remarks;
    }

    const admin = getAdminInfo(req);

    expense.updatedBy = admin.adminId || undefined;
    expense.updatedByName = admin.adminName;

    await expense.save();

    return res.status(200).json({
      message: "Expense updated successfully.",
      expense,
    });
  } catch (error) {
    console.error("Update expense error:", error);

    return res.status(400).json({
      message: error.message || "Failed to update expense.",
    });
  }
};

// ============================================================
// SOFT DELETE EXPENSE
// ============================================================

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: { $ne: true },
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found.",
      });
    }

    const admin = getAdminInfo(req);

    expense.isDeleted = true;
    expense.deletedAt = new Date();
    expense.deletedBy = admin.adminId || undefined;
    expense.deletedByName = admin.adminName;

    await expense.save();

    return res.status(200).json({
      message:
        "Expense deleted successfully. Its amount is excluded from active expense totals.",
      expense,
    });
  } catch (error) {
    console.error("Delete expense error:", error);

    return res.status(500).json({
      message: "Failed to delete expense.",
    });
  }
};

// ============================================================
// RESTORE SOFT-DELETED EXPENSE
// ============================================================

exports.restoreExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: true,
    });

    if (!expense) {
      return res.status(404).json({
        message: "Deleted expense not found.",
      });
    }

    if (expense.expenseType === "Salary") {
      if (!expense.worker || !isValidSalaryPeriod(expense.salaryPeriod)) {
        return res.status(400).json({
          message:
            "This payroll record is missing worker or salary-period information and cannot be restored safely.",
        });
      }

      const worker = await Worker.findById(expense.worker);

      if (!worker) {
        return res.status(400).json({
          message:
            "The worker linked to this payment no longer exists. The payroll payment cannot be restored.",
        });
      }

      const salaryRecord = await getSalaryRecord(
        expense.worker,
        expense.salaryPeriod,
      );

      const agreedSalary = Number(
        salaryRecord?.salaryAmount ?? expense.salaryAmount,
      );

      if (!Number.isFinite(agreedSalary) || agreedSalary <= 0) {
        return res.status(400).json({
          message:
            "The agreed monthly salary could not be verified. Set the monthly salary before restoring this payment.",
        });
      }

      const paidToDate = await getPaidToDate(
        expense.worker,
        expense.salaryPeriod,
      );

      const amountToRestore = roundMoney(expense.amount || 0);
      const outstanding = roundMoney(agreedSalary - paidToDate);

      if (amountToRestore > outstanding) {
        return res.status(400).json({
          message:
            "This payment cannot be restored because it would make total active payroll payments exceed the agreed monthly salary.",
          agreedSalary,
          paidToDate,
          amountToRestore,
          outstanding: Math.max(0, outstanding),
        });
      }
    }

    expense.isDeleted = false;
    expense.deletedAt = null;
    expense.deletedBy = null;
    expense.deletedByName = "";

    const admin = getAdminInfo(req);
    expense.updatedBy = admin.adminId || undefined;
    expense.updatedByName = admin.adminName;

    await expense.save();

    return res.status(200).json({
      message: "Expense restored successfully.",
      expense,
    });
  } catch (error) {
    console.error("Restore expense error:", error);

    return res.status(400).json({
      message: error.message || "Failed to restore expense.",
    });
  }
};

// ============================================================
// EXPENSE STATISTICS
// ============================================================

exports.getExpenseStats = async (req, res) => {
  try {
    const filter = buildExpenseFilter(req.query, false);

    const [summary, categoryBreakdown, paymentMethodBreakdown] =
      await Promise.all([
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalExpenses: { $sum: "$amount" },
              totalRecords: { $sum: 1 },
              averageExpense: { $avg: "$amount" },
            },
          },
        ]),
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$category",
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$paymentMethod",
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),
      ]);

    const totals = summary[0] || {
      totalExpenses: 0,
      totalRecords: 0,
      averageExpense: 0,
    };

    const [generalExpenses, salaryExpenses] = await Promise.all([
      Expense.aggregate([
        {
          $match: {
            ...filter,
            expenseType: { $ne: "Salary" },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
      Expense.aggregate([
        {
          $match: {
            ...filter,
            expenseType: "Salary",
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      ...totals,
      totalExpenses: roundMoney(totals.totalExpenses || 0),
      averageExpense: roundMoney(totals.averageExpense || 0),
      totalRecords: totals.totalRecords || 0,
      generalExpenses: roundMoney(generalExpenses[0]?.total || 0),
      salaryExpenses: roundMoney(salaryExpenses[0]?.total || 0),
      categoryBreakdown: categoryBreakdown.map((item) => ({
        category: item._id || "Uncategorised",
        total: roundMoney(item.total || 0),
        count: item.count || 0,
      })),
      paymentMethodBreakdown: paymentMethodBreakdown.map((item) => ({
        paymentMethod: item._id || "Unknown",
        total: roundMoney(item.total || 0),
        count: item.count || 0,
      })),
    });
  } catch (error) {
    console.error("Get expense stats error:", error);

    return res.status(500).json({
      message: "Failed to fetch expense statistics.",
    });
  }
};

// ============================================================
// EXPENSE REPORT
// ============================================================

exports.getExpenseReport = async (req, res) => {
  try {
    const filter = buildExpenseFilter(req.query, false);

    const [expensesByMonth, expensesByCategory, expensesByType, totals] =
      await Promise.all([
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                year: { $year: "$date" },
                month: { $month: "$date" },
              },
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$category",
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
        ]),
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                $ifNull: ["$expenseType", "General"],
              },
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        Expense.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalExpenses: { $sum: "$amount" },
              totalRecords: { $sum: 1 },
            },
          },
        ]),
      ]);

    return res.status(200).json({
      totals: {
        totalExpenses: roundMoney(totals[0]?.totalExpenses || 0),
        totalRecords: totals[0]?.totalRecords || 0,
      },
      monthly: expensesByMonth.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        total: roundMoney(item.total || 0),
        count: item.count || 0,
      })),
      categories: expensesByCategory.map((item) => ({
        category: item._id || "Uncategorised",
        total: roundMoney(item.total || 0),
        count: item.count || 0,
      })),
      expenseTypes: expensesByType.map((item) => ({
        expenseType: item._id,
        total: roundMoney(item.total || 0),
        count: item.count || 0,
      })),
    });
  } catch (error) {
    console.error("Get expense report error:", error);

    return res.status(500).json({
      message: "Failed to generate expense report.",
    });
  }
};

// ============================================================
// GET WORKERS FOR MONTHLY PAYROLL
// ============================================================

exports.getPayrollWorkers = async (req, res) => {
  try {
    const salaryPeriod = req.query.salaryPeriod;

    if (!isValidSalaryPeriod(salaryPeriod)) {
      return res.status(400).json({
        message: "Provide a valid salaryPeriod in YYYY-MM format.",
      });
    }

    const workers = await Worker.find({
      status: "Active",
    })
      .select(
        "firstName lastName employeeId staffId role department salary paymentFrequency status",
      )
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    const workerIds = workers.map((worker) => worker._id);

    const [salaryRecords, paymentTotals, paymentHistory] = await Promise.all([
      WorkerMonthlySalary.find({
        worker: { $in: workerIds },
        salaryPeriod,
      }).lean(),

      Expense.aggregate([
        {
          $match: {
            worker: { $in: workerIds },
            salaryPeriod,
            expenseType: "Salary",
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$worker",
            paidToDate: { $sum: "$amount" },
            paymentCount: { $sum: 1 },
          },
        },
      ]),

      Expense.find({
        worker: { $in: workerIds },
        salaryPeriod,
        expenseType: "Salary",
        isDeleted: { $ne: true },
      })
        .select(
          "expenseNumber worker workerName employeeId salaryPeriod salaryAmount amount date paymentMethod remarks createdAt createdByName",
        )
        .sort({ date: -1, createdAt: -1 })
        .lean(),
    ]);

    const salaryByWorker = new Map(
      salaryRecords.map((record) => [String(record.worker), record]),
    );

    const totalsByWorker = new Map(
      paymentTotals.map((record) => [String(record._id), record]),
    );

    const historyByWorker = new Map();

    for (const payment of paymentHistory) {
      const key = String(payment.worker);

      if (!historyByWorker.has(key)) {
        historyByWorker.set(key, []);
      }

      historyByWorker.get(key).push(payment);
    }

    const payrollWorkers = workers.map((worker) => {
      const key = String(worker._id);
      const salaryRecord = salaryByWorker.get(key);
      const totals = totalsByWorker.get(key);

      const agreedSalary = roundMoney(salaryRecord?.salaryAmount || 0);
      const paidToDate = roundMoney(totals?.paidToDate || 0);
      const outstanding = roundMoney(Math.max(0, agreedSalary - paidToDate));

      return {
        _id: worker._id,
        workerId: worker._id,
        workerName: getWorkerName(worker),
        firstName: worker.firstName || "",
        lastName: worker.lastName || "",
        employeeId: getEmployeeId(worker),
        role: worker.role || "",
        department: worker.department || "",
        status: worker.status,

        // The agreed salary must be set separately for each month.
        salaryAmount: agreedSalary,
        agreedSalary,
        salarySet: Boolean(salaryRecord),
        salarySetAt: salaryRecord?.updatedAt || salaryRecord?.createdAt || null,
        salarySetByName:
          salaryRecord?.updatedByName || salaryRecord?.setByName || "",

        // Existing Worker.salary is returned only as a suggestion.
        // It is never treated as the agreed monthly salary.
        suggestedSalary: Number(worker.salary) || 0,
        paymentFrequency: worker.paymentFrequency || "",

        paidToDate,
        outstanding,
        balance: outstanding,
        paymentCount: totals?.paymentCount || 0,
        payments: historyByWorker.get(key) || [],
        salaryPeriod,
      };
    });

    return res.status(200).json({
      salaryPeriod,
      workers: payrollWorkers,
      totalWorkers: payrollWorkers.length,
      totalAgreedSalary: roundMoney(
        payrollWorkers.reduce(
          (total, worker) => total + worker.agreedSalary,
          0,
        ),
      ),
      totalPaid: roundMoney(
        payrollWorkers.reduce((total, worker) => total + worker.paidToDate, 0),
      ),
      totalOutstanding: roundMoney(
        payrollWorkers.reduce((total, worker) => total + worker.outstanding, 0),
      ),
    });
  } catch (error) {
    console.error("Get payroll workers error:", error);

    return res.status(500).json({
      message: "Failed to fetch payroll workers.",
    });
  }
};

// ============================================================
// SET AGREED MONTHLY SALARY FOR ONE WORKER
// POST /api/expenses/payroll/salary
// ============================================================

exports.setPayrollSalary = async (req, res) => {
  try {
    const { workerId, salaryPeriod, salaryAmount } = req.body;

    if (!workerId || !isValidObjectId(workerId)) {
      return res.status(400).json({
        message: "Select a valid worker.",
      });
    }

    if (!isValidSalaryPeriod(salaryPeriod)) {
      return res.status(400).json({
        message: "Select a valid salary month in YYYY-MM format.",
      });
    }

    const agreedSalary = validatePositiveAmount(
      salaryAmount,
      "Agreed monthly salary",
    );

    const worker = await getActiveWorker(workerId);

    const paidToDate = await getPaidToDate(worker._id, salaryPeriod);

    if (agreedSalary < paidToDate) {
      return res.status(400).json({
        message:
          "The agreed monthly salary cannot be lower than the payments already recorded for this month.",
        paidToDate,
        salaryAmount: agreedSalary,
      });
    }

    const admin = getAdminInfo(req);

    const salaryRecord = await WorkerMonthlySalary.findOneAndUpdate(
      {
        worker: worker._id,
        salaryPeriod,
      },
      {
        $set: {
          salaryAmount: agreedSalary,
          workerName: getWorkerName(worker),
          employeeId: getEmployeeId(worker),
          updatedBy: admin.adminId || null,
          updatedByName: admin.adminName,
        },
        $setOnInsert: {
          worker: worker._id,
          salaryPeriod,
          setBy: admin.adminId || null,
          setByName: admin.adminName,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      message: "Agreed monthly salary saved successfully.",
      salary: salaryRecord,
      worker: {
        _id: worker._id,
        workerName: getWorkerName(worker),
        employeeId: getEmployeeId(worker),
      },
      salaryPeriod,
      salaryAmount: agreedSalary,
      paidToDate,
      outstanding: roundMoney(agreedSalary - paidToDate),
    });
  } catch (error) {
    console.error("Set payroll salary error:", error);

    return res.status(400).json({
      message: error.message || "Failed to save the agreed monthly salary.",
    });
  }
};

// ============================================================
// CREATE ONE SALARY PAYMENT
// POST /api/expenses/payroll/payment
// ============================================================

exports.createSalaryPayment = async (req, res) => {
  try {
    const { workerId, salaryPeriod, amount, paymentMethod, date, remarks } =
      req.body;

    const admin = getAdminInfo(req);

    const expense = await createSalaryPaymentRecord({
      workerId,
      salaryPeriod,
      amount,
      paymentMethod,
      date,
      remarks,
      adminId: admin.adminId,
      adminName: admin.adminName,
    });

    const paidToDate = await getPaidToDate(
      expense.worker,
      expense.salaryPeriod,
    );

    const salaryRecord = await getSalaryRecord(
      expense.worker,
      expense.salaryPeriod,
    );

    const agreedSalary = Number(
      salaryRecord?.salaryAmount ?? expense.salaryAmount,
    );

    return res.status(201).json({
      message: "Salary payment recorded successfully.",
      expense,
      payment: expense,
      salaryPeriod: expense.salaryPeriod,
      agreedSalary,
      paidToDate,
      outstanding: roundMoney(Math.max(0, agreedSalary - paidToDate)),
    });
  } catch (error) {
    console.error("Create salary payment error:", error);

    return res.status(400).json({
      message: error.message || "Failed to record salary payment.",
    });
  }
};

// ============================================================
// CREATE MULTIPLE SALARY PAYMENTS
// POST /api/expenses/payroll/bulk
// ============================================================

exports.createBulkSalaryPayments = async (req, res) => {
  const { salaryPeriod, payments, workers, paymentMethod, date, remarks } =
    req.body;

  if (!isValidSalaryPeriod(salaryPeriod)) {
    return res.status(400).json({
      message: "Select a valid salary month in YYYY-MM format.",
    });
  }

  // "workers" is supported for compatibility with older frontend code.
  const submittedPayments = Array.isArray(payments)
    ? payments
    : Array.isArray(workers)
      ? workers
      : [];

  if (!submittedPayments.length) {
    return res.status(400).json({
      message: "Provide at least one worker payment.",
    });
  }

  const admin = getAdminInfo(req);
  const payrollBatchId = new mongoose.Types.ObjectId().toString();

  const results = [];
  const errors = [];

  for (let index = 0; index < submittedPayments.length; index += 1) {
    const item = submittedPayments[index] || {};

    const workerId = item.workerId || item.worker || item._id;

    const paymentAmount =
      item.amount !== undefined ? item.amount : item.paymentAmount;

    const itemPaymentMethod = item.paymentMethod || paymentMethod;

    const itemDate = item.date || date;

    const itemRemarks = item.remarks !== undefined ? item.remarks : remarks;

    // A zero or empty amount means no payment was submitted for this worker.
    if (
      paymentAmount === undefined ||
      paymentAmount === null ||
      paymentAmount === "" ||
      Number(paymentAmount) === 0
    ) {
      continue;
    }

    try {
      const expense = await createSalaryPaymentRecord({
        workerId,
        salaryPeriod,
        amount: paymentAmount,
        paymentMethod: itemPaymentMethod,
        date: itemDate,
        remarks: itemRemarks,
        payrollBatchId,
        adminId: admin.adminId,
        adminName: admin.adminName,
      });

      results.push(expense);
    } catch (error) {
      errors.push({
        workerId: workerId || null,
        message: error.message || "Payment failed.",
      });
    }
  }

  if (!results.length) {
    return res.status(400).json({
      message: "No salary payments were recorded.",
      errors,
    });
  }

  return res.status(errors.length ? 207 : 201).json({
    message: errors.length
      ? "Some salary payments were recorded, but some failed."
      : "All salary payments were recorded successfully.",
    salaryPeriod,
    payrollBatchId,
    count: results.length,
    payments: results,
    expenses: results,
    errors,
  });
};
