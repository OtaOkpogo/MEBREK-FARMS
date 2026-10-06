const Expense = require("../models/Expense");
const Counter = require("../models/Counter");

// ============================================================
// HELPERS
// ============================================================

const getAdminInfo = (req) => {
  const admin = req.admin || req.user || {};

  return {
    id: admin._id || admin.id || null,
    name:
      admin.name ||
      admin.fullName ||
      admin.adminName ||
      admin.email ||
      "Unknown Admin",
  };
};

// ============================================================
// ATOMIC EXPENSE NUMBER GENERATOR
// ============================================================

const generateExpenseNumber = async () => {
  const year = new Date().getFullYear();

  const counterKey = `expense-${year}`;

  const counter = await Counter.findOneAndUpdate(
    {
      _id: counterKey,
    },
    {
      $inc: {
        seq: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );

  return `EXP-${year}-${String(counter.seq).padStart(6, "0")}`;
};

// ============================================================
// VALIDATION
// ============================================================

const validateExpenseData = ({
  date,
  category,
  description,
  quantity,
  unitCost,
  paymentMethod,
}) => {
  const errors = [];

  const allowedCategories = [
    "Feed",
    "Drugs",
    "Labour",
    "Fuel",
    "Repairs",
    "Utilities",
    "Transport",
    "Other",
  ];

  const allowedPaymentMethods = ["Cash", "Transfer", "POS"];

  // ----------------------------------------------------------
  // DATE
  // ----------------------------------------------------------

  if (!date) {
    errors.push("Expense date is required.");
  } else {
    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      errors.push("Expense date is invalid.");
    }
  }

  // ----------------------------------------------------------
  // CATEGORY
  // ----------------------------------------------------------

  if (!category) {
    errors.push("Expense category is required.");
  } else if (!allowedCategories.includes(category)) {
    errors.push("Invalid expense category.");
  }

  // ----------------------------------------------------------
  // DESCRIPTION
  // ----------------------------------------------------------

  if (!description || !String(description).trim()) {
    errors.push("Expense description is required.");
  } else if (String(description).trim().length < 2) {
    errors.push("Expense description must contain at least 2 characters.");
  } else if (String(description).trim().length > 500) {
    errors.push("Expense description cannot exceed 500 characters.");
  }

  // ----------------------------------------------------------
  // QUANTITY
  // ----------------------------------------------------------

  const parsedQuantity = Number(quantity);

  if (!Number.isFinite(parsedQuantity)) {
    errors.push("Quantity must be a valid number.");
  } else if (parsedQuantity < 0) {
    errors.push("Quantity cannot be negative.");
  }

  // ----------------------------------------------------------
  // UNIT COST
  // ----------------------------------------------------------

  const parsedUnitCost = Number(unitCost);

  if (!Number.isFinite(parsedUnitCost)) {
    errors.push("Unit cost must be a valid number.");
  } else if (parsedUnitCost < 0) {
    errors.push("Unit cost cannot be negative.");
  }

  // ----------------------------------------------------------
  // PAYMENT METHOD
  // ----------------------------------------------------------

  if (paymentMethod && !allowedPaymentMethods.includes(paymentMethod)) {
    errors.push("Invalid payment method.");
  }

  return errors;
};

// ============================================================
// DATE FILTER HELPER
// ============================================================

const applyDateFilter = (query, startDate, endDate) => {
  if (!startDate && !endDate) {
    return;
  }

  query.date = {};

  if (startDate) {
    const parsedStartDate = new Date(`${startDate}T00:00:00.000Z`);

    if (!Number.isNaN(parsedStartDate.getTime())) {
      query.date.$gte = parsedStartDate;
    }
  }

  if (endDate) {
    const parsedEndDate = new Date(`${endDate}T23:59:59.999Z`);

    if (!Number.isNaN(parsedEndDate.getTime())) {
      query.date.$lte = parsedEndDate;
    }
  }

  if (Object.keys(query.date).length === 0) {
    delete query.date;
  }
};

// ============================================================
// SEARCH FILTER HELPER
// ============================================================

const applySearchFilter = (query, search) => {
  if (!search || !String(search).trim()) {
    return;
  }

  const searchRegex = new RegExp(
    String(search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i",
  );

  query.$or = [
    {
      expenseNumber: searchRegex,
    },
    {
      description: searchRegex,
    },
    {
      supplier: searchRegex,
    },
    {
      category: searchRegex,
    },
    {
      paymentMethod: searchRegex,
    },
    {
      remarks: searchRegex,
    },
    {
      createdByName: searchRegex,
    },
  ];
};

// ============================================================
// CREATE EXPENSE
// ============================================================

exports.createExpense = async (req, res) => {
  try {
    const {
      date,
      category,
      description,
      quantity = 1,
      unitCost = 0,
      supplier = "",
      paymentMethod = "Cash",
      remarks = "",
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------

    const validationErrors = validateExpenseData({
      date,
      category,
      description,
      quantity,
      unitCost,
      paymentMethod,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors[0],
        errors: validationErrors,
      });
    }

    const parsedQuantity = Number(quantity);
    const parsedUnitCost = Number(unitCost);

    // --------------------------------------------------------
    // SERVER-SIDE AMOUNT CALCULATION
    // --------------------------------------------------------

    const amount = parsedQuantity * parsedUnitCost;

    // --------------------------------------------------------
    // ADMIN INFORMATION
    // --------------------------------------------------------

    const { id: adminId, name: adminName } = getAdminInfo(req);

    // --------------------------------------------------------
    // ATOMIC EXPENSE NUMBER
    // --------------------------------------------------------

    const expenseNumber = await generateExpenseNumber();

    // --------------------------------------------------------
    // CREATE
    // --------------------------------------------------------

    const expense = await Expense.create({
      expenseNumber,

      date,
      category,
      description: String(description).trim(),

      quantity: parsedQuantity,
      unitCost: parsedUnitCost,
      amount,

      supplier: String(supplier || "").trim(),

      paymentMethod,

      remarks: String(remarks || "").trim(),

      createdBy: adminId,
      createdByName: adminName,

      updatedBy: null,
      updatedByName: "",

      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      deletedByName: "",
    });

    return res.status(201).json({
      message: "Expense created successfully.",
      expense,
    });
  } catch (error) {
    console.error("CREATE EXPENSE ERROR:", error);

    // --------------------------------------------------------
    // DUPLICATE EXPENSE NUMBER
    // --------------------------------------------------------

    if (error.code === 11000) {
      if (error.keyPattern?.expenseNumber) {
        return res.status(409).json({
          message: "Expense reference number already exists. Please try again.",
        });
      }

      return res.status(409).json({
        message: "A duplicate expense record was detected.",
      });
    }

    // --------------------------------------------------------
    // MONGOOSE VALIDATION
    // --------------------------------------------------------

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((item) => item.message);

      return res.status(400).json({
        message: errors[0] || "Expense validation failed.",
        errors,
      });
    }

    return res.status(500).json({
      message: "Failed to create expense.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// GET ACTIVE EXPENSES
// WITH SERVER-SIDE PAGINATION + FILTERING
// ============================================================

exports.getExpenses = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "All",
      paymentMethod = "All",
      startDate = "",
      endDate = "",
    } = req.query;

    // --------------------------------------------------------
    // PAGINATION
    // --------------------------------------------------------

    let parsedPage = Number.parseInt(page, 10);

    let parsedLimit = Number.parseInt(limit, 10);

    if (!Number.isFinite(parsedPage) || parsedPage < 1) {
      parsedPage = 1;
    }

    if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
      parsedLimit = 10;
    }

    // Prevent unnecessarily large requests.
    if (parsedLimit > 100) {
      parsedLimit = 100;
    }

    // --------------------------------------------------------
    // BASE QUERY
    // --------------------------------------------------------

    const query = {
      $or: [
        {
          isDeleted: false,
        },
        {
          isDeleted: {
            $exists: false,
          },
        },
      ],
    };

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    const allowedCategories = [
      "Feed",
      "Drugs",
      "Labour",
      "Fuel",
      "Repairs",
      "Utilities",
      "Transport",
      "Other",
    ];

    if (category && category !== "All") {
      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          message: "Invalid expense category.",
        });
      }

      query.category = category;
    }

    // --------------------------------------------------------
    // PAYMENT METHOD
    // --------------------------------------------------------

    const allowedPaymentMethods = ["Cash", "Transfer", "POS"];

    if (paymentMethod && paymentMethod !== "All") {
      if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          message: "Invalid payment method.",
        });
      }

      query.paymentMethod = paymentMethod;
    }

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    applySearchFilter(query, search);

    // --------------------------------------------------------
    // DATE RANGE
    // --------------------------------------------------------

    applyDateFilter(query, startDate, endDate);

    // --------------------------------------------------------
    // TOTAL COUNT
    // --------------------------------------------------------

    const totalRecords = await Expense.countDocuments(query);

    const totalPages =
      totalRecords === 0 ? 0 : Math.ceil(totalRecords / parsedLimit);

    // --------------------------------------------------------
    // KEEP REQUESTED PAGE IN RANGE
    // --------------------------------------------------------

    if (totalPages > 0 && parsedPage > totalPages) {
      parsedPage = totalPages;
    }

    const skip = (parsedPage - 1) * parsedLimit;

    // --------------------------------------------------------
    // FETCH PAGE
    // --------------------------------------------------------

    const expenses = await Expense.find(query)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .sort({
        date: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    return res.status(200).json({
      expenses,

      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalRecords,
        totalPages,

        hasNextPage: parsedPage < totalPages,

        hasPreviousPage: parsedPage > 1 && totalPages > 0,
      },

      filters: {
        search,
        category,
        paymentMethod,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("GET EXPENSES ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch expenses.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// GET DELETED EXPENSES
// ============================================================

exports.getDeletedExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({
      isDeleted: true,
    })
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .populate("deletedBy", "name email role")
      .sort({
        deletedAt: -1,
        updatedAt: -1,
      })
      .lean();

    return res.status(200).json({
      expenses,
    });
  } catch (error) {
    console.error("GET DELETED EXPENSES ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch deleted expenses.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// UPDATE EXPENSE
// ============================================================

exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      date,
      category,
      description,
      quantity = 1,
      unitCost = 0,
      supplier = "",
      paymentMethod = "Cash",
      remarks = "",
    } = req.body;

    // --------------------------------------------------------
    // VALIDATE
    // --------------------------------------------------------

    const validationErrors = validateExpenseData({
      date,
      category,
      description,
      quantity,
      unitCost,
      paymentMethod,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: validationErrors[0],
        errors: validationErrors,
      });
    }

    const parsedQuantity = Number(quantity);
    const parsedUnitCost = Number(unitCost);

    const amount = parsedQuantity * parsedUnitCost;

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    const { id: adminId, name: adminName } = getAdminInfo(req);

    // --------------------------------------------------------
    // ONLY ACTIVE EXPENSES CAN BE UPDATED
    // --------------------------------------------------------

    const expense = await Expense.findOne({
      _id: id,

      $or: [
        {
          isDeleted: false,
        },
        {
          isDeleted: {
            $exists: false,
          },
        },
      ],
    });

    if (!expense) {
      return res.status(404).json({
        message: "Active expense not found.",
      });
    }

    // --------------------------------------------------------
    // UPDATE
    // --------------------------------------------------------

    expense.date = date;
    expense.category = category;
    expense.description = String(description).trim();

    expense.quantity = parsedQuantity;
    expense.unitCost = parsedUnitCost;

    // Never trust amount supplied by frontend.
    expense.amount = amount;

    expense.supplier = String(supplier || "").trim();

    expense.paymentMethod = paymentMethod;

    expense.remarks = String(remarks || "").trim();

    expense.updatedBy = adminId;
    expense.updatedByName = adminName;

    await expense.save();

    const populatedExpense = await Expense.findById(expense._id)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .lean();

    return res.status(200).json({
      message: "Expense updated successfully.",
      expense: populatedExpense || expense,
    });
  } catch (error) {
    console.error("UPDATE EXPENSE ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((item) => item.message);

      return res.status(400).json({
        message: errors[0] || "Expense validation failed.",
        errors,
      });
    }

    return res.status(500).json({
      message: "Failed to update expense.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// SOFT DELETE EXPENSE
// ============================================================

exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const { id: adminId, name: adminName } = getAdminInfo(req);

    const expense = await Expense.findOne({
      _id: id,

      $or: [
        {
          isDeleted: false,
        },
        {
          isDeleted: {
            $exists: false,
          },
        },
      ],
    });

    if (!expense) {
      return res.status(404).json({
        message: "Active expense not found.",
      });
    }

    // --------------------------------------------------------
    // SOFT DELETE
    // --------------------------------------------------------

    expense.isDeleted = true;

    expense.deletedAt = new Date();

    expense.deletedBy = adminId;

    expense.deletedByName = adminName;

    await expense.save();

    return res.status(200).json({
      message: "Expense deleted successfully.",
      expense,
    });
  } catch (error) {
    console.error("DELETE EXPENSE ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    return res.status(500).json({
      message: "Failed to delete expense.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// RESTORE EXPENSE
// ============================================================

exports.restoreExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await Expense.findOne({
      _id: id,
      isDeleted: true,
    });

    if (!expense) {
      return res.status(404).json({
        message: "Deleted expense not found.",
      });
    }

    // --------------------------------------------------------
    // RESTORE
    // --------------------------------------------------------

    expense.isDeleted = false;

    expense.deletedAt = null;

    expense.deletedBy = null;

    expense.deletedByName = "";

    await expense.save();

    const restoredExpense = await Expense.findById(expense._id)
      .populate("createdBy", "name email role")
      .populate("updatedBy", "name email role")
      .lean();

    return res.status(200).json({
      message: "Expense restored successfully.",
      expense: restoredExpense || expense,
    });
  } catch (error) {
    console.error("RESTORE EXPENSE ERROR:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid expense ID.",
      });
    }

    return res.status(500).json({
      message: "Failed to restore expense.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// BASIC EXPENSE STATS
// ============================================================

exports.getExpenseStats = async (req, res) => {
  try {
    const activeFilter = {
      $or: [
        {
          isDeleted: false,
        },
        {
          isDeleted: {
            $exists: false,
          },
        },
      ],
    };

    const stats = await Expense.aggregate([
      {
        $match: activeFilter,
      },

      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,

                totalExpenses: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },
              },
            },
          ],

          categoryBreakdown: [
            {
              $group: {
                _id: "$category",

                count: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },
              },
            },

            {
              $sort: {
                totalAmount: -1,
              },
            },
          ],
        },
      },
    ]);

    const result = stats[0] || {};

    const overall = result.overall?.[0] || {
      totalExpenses: 0,
      totalAmount: 0,
    };

    const categoryBreakdown = (result.categoryBreakdown || []).map((item) => ({
      category: item._id || "Other",

      count: item.count || 0,

      totalAmount: item.totalAmount || 0,
    }));

    return res.status(200).json({
      totalExpenses: overall.totalExpenses || 0,

      totalAmount: overall.totalAmount || 0,

      categoryBreakdown,
    });
  } catch (error) {
    console.error("GET EXPENSE STATS ERROR:", error);

    return res.status(500).json({
      message: "Failed to fetch expense statistics.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ============================================================
// SERVER-SIDE FINANCIAL REPORT
// ============================================================

exports.getExpenseReport = async (req, res) => {
  try {
    const { startDate, endDate, category, paymentMethod } = req.query;

    // --------------------------------------------------------
    // BASE FILTER
    // --------------------------------------------------------

    const match = {
      $or: [
        {
          isDeleted: false,
        },
        {
          isDeleted: {
            $exists: false,
          },
        },
      ],
    };

    // --------------------------------------------------------
    // DATE FILTER
    // --------------------------------------------------------

    if (startDate || endDate) {
      match.date = {};

      if (startDate) {
        const parsedStartDate = new Date(`${startDate}T00:00:00.000Z`);

        if (Number.isNaN(parsedStartDate.getTime())) {
          return res.status(400).json({
            message: "Invalid startDate.",
          });
        }

        match.date.$gte = parsedStartDate;
      }

      if (endDate) {
        const parsedEndDate = new Date(`${endDate}T23:59:59.999Z`);

        if (Number.isNaN(parsedEndDate.getTime())) {
          return res.status(400).json({
            message: "Invalid endDate.",
          });
        }

        match.date.$lte = parsedEndDate;
      }
    }

    // --------------------------------------------------------
    // CATEGORY
    // --------------------------------------------------------

    const allowedCategories = [
      "Feed",
      "Drugs",
      "Labour",
      "Fuel",
      "Repairs",
      "Utilities",
      "Transport",
      "Other",
    ];

    if (category && category !== "All") {
      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          message: "Invalid expense category.",
        });
      }

      match.category = category;
    }

    // --------------------------------------------------------
    // PAYMENT METHOD
    // --------------------------------------------------------

    const allowedPaymentMethods = ["Cash", "Transfer", "POS"];

    if (paymentMethod && paymentMethod !== "All") {
      if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
          message: "Invalid payment method.",
        });
      }

      match.paymentMethod = paymentMethod;
    }

    // --------------------------------------------------------
    // AGGREGATION
    // --------------------------------------------------------

    const report = await Expense.aggregate([
      {
        $match: match,
      },

      {
        $facet: {
          // ------------------------------------------------
          // SUMMARY
          // ------------------------------------------------

          summary: [
            {
              $group: {
                _id: null,

                totalExpenses: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },

                averageExpense: {
                  $avg: {
                    $ifNull: ["$amount", 0],
                  },
                },

                largestExpense: {
                  $max: {
                    $ifNull: ["$amount", 0],
                  },
                },
              },
            },
          ],

          // ------------------------------------------------
          // CATEGORY
          // ------------------------------------------------

          categoryBreakdown: [
            {
              $group: {
                _id: "$category",

                count: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },
              },
            },

            {
              $sort: {
                totalAmount: -1,
              },
            },
          ],

          // ------------------------------------------------
          // PAYMENT METHOD
          // ------------------------------------------------

          paymentMethodBreakdown: [
            {
              $group: {
                _id: "$paymentMethod",

                count: {
                  $sum: 1,
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },
              },
            },

            {
              $sort: {
                totalAmount: -1,
              },
            },
          ],

          // ------------------------------------------------
          // MONTHLY TREND
          // ------------------------------------------------

          monthlyTrend: [
            {
              $group: {
                _id: {
                  year: {
                    $year: "$date",
                  },

                  month: {
                    $month: "$date",
                  },
                },

                totalAmount: {
                  $sum: {
                    $ifNull: ["$amount", 0],
                  },
                },

                count: {
                  $sum: 1,
                },
              },
            },

            {
              $sort: {
                "_id.year": 1,
                "_id.month": 1,
              },
            },
          ],
        },
      },
    ]);

    const result = report[0] || {};

    const summary = result.summary?.[0] || {
      totalExpenses: 0,
      totalAmount: 0,
      averageExpense: 0,
      largestExpense: 0,
    };

    const categoryResults = (result.categoryBreakdown || []).map((item) => ({
      category: item._id || "Other",

      count: item.count || 0,

      totalAmount: item.totalAmount || 0,
    }));

    const paymentResults = (result.paymentMethodBreakdown || []).map(
      (item) => ({
        paymentMethod: item._id || "Cash",

        count: item.count || 0,

        totalAmount: item.totalAmount || 0,
      }),
    );

    const monthlyResults = (result.monthlyTrend || []).map((item) => ({
      year: item._id.year,

      month: item._id.month,

      count: item.count || 0,

      totalAmount: item.totalAmount || 0,
    }));

    return res.status(200).json({
      filters: {
        startDate: startDate || null,

        endDate: endDate || null,

        category: category || "All",

        paymentMethod: paymentMethod || "All",
      },

      summary: {
        totalExpenses: summary.totalExpenses || 0,

        totalAmount: summary.totalAmount || 0,

        averageExpense: summary.averageExpense || 0,

        largestExpense: summary.largestExpense || 0,
      },

      categoryBreakdown: categoryResults,

      paymentMethodBreakdown: paymentResults,

      monthlyTrend: monthlyResults,
    });
  } catch (error) {
    console.error("GET EXPENSE REPORT ERROR:", error);

    return res.status(500).json({
      message: "Failed to generate expense report.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
