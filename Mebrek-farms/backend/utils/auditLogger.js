
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");

// ============================================================
// SENSITIVE DATA PROTECTION
// ============================================================

const SENSITIVE_FIELDS = [
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "jwt",
  "apikey",
  "otp",
  "resettoken",
  "cookie",
];

const isSensitiveField = (key) => {
  const normalized = String(key).toLowerCase().replace(/[_-]/g, "");

  return SENSITIVE_FIELDS.some((field) =>
    normalized.includes(field)
  );
};

// ============================================================
// SANITIZE AUDIT DATA
// ============================================================

const sanitizeAuditData = (value, depth = 0) => {
  if (value === null || value === undefined) return value;

  if (depth > 6) return "[Maximum depth reached]";

  if (value instanceof Date) return value;

  if (mongoose.isValidObjectId(value) && typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) =>
      sanitizeAuditData(item, depth + 1)
    );
  }

  if (typeof value === "object") {
    const sanitized = {};

    for (const [key, item] of Object.entries(value)) {
      if (isSensitiveField(key)) {
        sanitized[key] = "[REDACTED]";
        continue;
      }

      sanitized[key] = sanitizeAuditData(item, depth + 1);
    }

    return sanitized;
  }

  if (typeof value === "string") {
    return value.length > 2000
      ? `${value.substring(0, 2000)}...[TRUNCATED]`
      : value;
  }

  return value;
};

// ============================================================
// AUDIT LOGGER
// ============================================================

const logAudit = async (req, details = {}) => {
  try {
    const user = req?.user || req?.admin || {};

    const allowedRoles = [
      "superadmin",
      "manager",
      "staff",
      "unknown",
    ];

    const role = allowedRoles.includes(user.role)
      ? user.role
      : "unknown";

    const actorId = user.id || user._id || null;

    const validActorId =
      actorId && mongoose.Types.ObjectId.isValid(actorId)
        ? actorId
        : null;

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

    const action = String(details.action || "OTHER").toUpperCase();

    const auditRecord = {
      actorId: validActorId,
      actorName: user.name || "Unknown User",
      actorEmail: user.email || "Unknown",
      actorRole: role,

      action: allowedActions.includes(action)
        ? action
        : "OTHER",

      module: details.module || "System",
      description:
        details.description || "System activity recorded",

      entityId:
        details.entityId &&
        mongoose.Types.ObjectId.isValid(details.entityId)
          ? details.entityId
          : null,

      entityName: details.entityName || null,

      before: sanitizeAuditData(details.before),
      after: sanitizeAuditData(details.after),

      metadata: sanitizeAuditData(details.metadata || {}),

      ipAddress:
        req?.ip ||
        req?.socket?.remoteAddress ||
        "Unknown",

      userAgent:
        req?.get?.("user-agent") ||
        "Unknown",
    };

    await AuditLog.create(auditRecord);

    return true;
  } catch (error) {
    // Audit failures must not interrupt normal business operations.
    console.error("AUDIT LOG ERROR:", error.message);

    return false;
  }
};

module.exports = {
  logAudit,
  sanitizeAuditData,
};

