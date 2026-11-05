
const AuditLog = require("../models/AuditLog");

// ============================================================
// ESCAPE REGULAR EXPRESSION INPUT
// ============================================================

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// ============================================================
// GET AUDIT LOGS
// GET /api/audit-logs
// ============================================================

const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      role = "",
      action = "",
      module = "",
      from = "",
      to = "",
    } = req.query;

    // --------------------------------------------------------
    // PAGINATION VALIDATION
    // --------------------------------------------------------

    const currentPage = Math.max(1, parseInt(page, 10) || 1);

    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 20)
    );

    const skip = (currentPage - 1) * pageSize;

    // --------------------------------------------------------
    // BUILD FILTER
    // --------------------------------------------------------

    const filter = {};

    // Search by user, email, module, description or IP address.
    if (search.trim()) {
      const searchRegex = new RegExp(
        escapeRegex(search.trim()),
        "i"
      );

      filter.$or = [
        { actorName: searchRegex },
        { actorEmail: searchRegex },
        { module: searchRegex },
        { description: searchRegex },
        { ipAddress: searchRegex },
        { entityName: searchRegex },
      ];
    }

    // Filter by user role.
    if (role) {
      const allowedRoles = [
        "superadmin",
        "manager",
        "staff",
        "unknown",
      ];

      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role filter.",
        });
      }

      filter.actorRole = role;
    }

    // Filter by action.
    if (action) {
      const allowedActions = [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "RESTORE",
        "LOGIN",
        "LOGOUT",
        "APPROVE",
        "REJECT",
        "EXPORT",
        "BACKUP",
        "ROLE_CHANGE",
        "PASSWORD_RESET",
        "STATUS_CHANGE",
        "OTHER",
      ];

      const normalizedAction = action.toUpperCase();

      if (!allowedActions.includes(normalizedAction)) {
        return res.status(400).json({
          success: false,
          message: "Invalid action filter.",
        });
      }

      filter.action = normalizedAction;
    }

    // Filter by module.
    if (module.trim()) {
      filter.module = new RegExp(
        `^${escapeRegex(module.trim())}$`,
        "i"
      );
    }

    // --------------------------------------------------------
    // DATE FILTERS
    // --------------------------------------------------------

    if (from || to) {
      filter.createdAt = {};

      if (from) {
        const startDate = new Date(from);

        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date.",
          });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
          startDate.setHours(0, 0, 0, 0);
        }

        filter.createdAt.$gte = startDate;
      }

      if (to) {
        const endDate = new Date(to);

        if (Number.isNaN(endDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date.",
          });
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
          endDate.setHours(23, 59, 59, 999);
        }

        filter.createdAt.$lte = endDate;
      }

      if (
        filter.createdAt.$gte &&
        filter.createdAt.$lte &&
        filter.createdAt.$gte > filter.createdAt.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "Start date cannot be later than end date.",
        });
      }
    }

    // --------------------------------------------------------
    // FETCH AUDIT RECORDS
    // --------------------------------------------------------

    const [activities, totalRecords] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      AuditLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / pageSize);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    return res.status(200).json({
      success: true,
      activities,

      pagination: {
        currentPage,
        pageSize,
        totalRecords,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve audit logs.",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getAuditLogs,
};

