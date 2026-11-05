const LoginActivity = require("../models/LoginActivity");

// ================= GET LOGIN ACTIVITIES =================

exports.getLoginActivities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "",
      status = "",
      from = "",
      to = "",
    } = req.query;

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 20),
    );

    const filter = {};

    // Search by account name or email
    if (search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );

      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    if (["superadmin", "manager", "staff", "unknown"].includes(role)) {
      filter.role = role;
    }

    if (["success", "failed", "blocked"].includes(status)) {
      filter.status = status;
    }

    // Date filtering
    if (from || to) {
      filter.createdAt = {};

      if (from) {
        const fromDate = new Date(`${from}T00:00:00.000`);

        if (Number.isNaN(fromDate.getTime())) {
          return res.status(400).json({
            message: "Invalid start date",
          });
        }

        filter.createdAt.$gte = fromDate;
      }

      if (to) {
        const toDate = new Date(`${to}T23:59:59.999`);

        if (Number.isNaN(toDate.getTime())) {
          return res.status(400).json({
            message: "Invalid end date",
          });
        }

        filter.createdAt.$lte = toDate;
      }
    }

    const skip = (currentPage - 1) * pageSize;

    const [activities, totalRecords] = await Promise.all([
      LoginActivity.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      LoginActivity.countDocuments(filter),
    ]);

    res.json({
      activities,
      pagination: {
        currentPage,
        pageSize,
        totalRecords,
        totalPages: Math.ceil(totalRecords / pageSize),
      },
    });
  } catch (error) {
    console.error("GET LOGIN ACTIVITIES ERROR:", error);

    res.status(500).json({
      message: "Unable to retrieve login activities",
      error: error.message,
    });
  }
};
