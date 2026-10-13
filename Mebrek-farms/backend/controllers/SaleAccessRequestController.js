const mongoose = require("mongoose");

const SaleAccessRequest = require("../models/SaleAccessRequest");
const EggSale = require("../models/EggSale");
const ManureSale = require("../models/ManureSale");
const Customer = require("../models/Customer");

const ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACCESS_DURATION_MS = 2 * 60 * 60 * 1000;

// ============================================================
// HELPERS
// ============================================================

const requesterId = (req) => req.user?.id || req.user?._id || null;

const requesterName = (req) => req.user?.name || req.user?.adminName || "";

const getModel = (type) => {
  if (type === "egg") return EggSale;
  if (type === "manure") return ManureSale;
  return null;
};

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getIdentifierType = (value) => {
  const type = String(value || "").trim();

  return ["invoiceNumber", "phone", "customerName"].includes(type)
    ? type
    : null;
};

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

const buildPhonePattern = (phone) => {
  const digits = normalizePhone(phone);

  if (!digits) return null;

  return {
    $regex: digits.split("").map(escapeRegex).join("\\D*"),
  };
};

/**
 * Builds a search using the actual EggSale and ManureSale schemas.
 *
 * EggSale:
 *   customerId, customer, phone
 *
 * ManureSale:
 *   customer, phone
 *
 * Legacy sales without customerId can still be matched using
 * their saved customer name or phone.
 */
const buildSaleSearch = ({
  identifierType,
  identifier,
  saleType,
  customerId,
  customerPhone,
}) => {
  if (identifierType === "invoiceNumber") {
    return {
      invoiceNumber: {
        $regex: `^${escapeRegex(identifier)}$`,
        $options: "i",
      },
    };
  }

  if (identifierType === "customerName") {
    const namePattern = {
      $regex: `^${escapeRegex(identifier)}$`,
      $options: "i",
    };

    const phonePattern = buildPhonePattern(customerPhone);

    const legacyCustomerMatch = [
      { customer: namePattern },
      ...(phonePattern ? [{ phone: phonePattern }] : []),
    ];

    if (saleType === "egg" && customerId) {
      return {
        $or: [
          { customerId },
          {
            $and: [
              {
                $or: [{ customerId: null }, { customerId: { $exists: false } }],
              },
              { $or: legacyCustomerMatch },
            ],
          },
        ],
      };
    }

    return {
      $or: legacyCustomerMatch,
    };
  }

  if (identifierType === "phone") {
    const phonePattern = buildPhonePattern(identifier);

    if (!phonePattern) return null;

    return {
      phone: phonePattern,
    };
  }

  return null;
};

const emitSocketEvent = (req, room, eventName, payload) => {
  const io = req.app.get("io");

  if (!io) {
    console.warn(`Socket.IO unavailable; could not emit ${eventName}`);
    return;
  }

  io.to(room).emit(eventName, payload);
};

const saleSummary = (sale) => ({
  _id: sale._id,
  invoiceNumber: sale.invoiceNumber || "",
  customer: sale.customer || "",
  phone: sale.phone || "",
  createdAt: sale.createdAt || null,
  date: sale.date || null,
});

/**
 * The 24-hour access restriction is based on createdAt,
 * consistent with the existing access-request workflow.
 */
const isOlderThanAccessWindow = (sale) => {
  if (!sale?.createdAt) return false;

  return new Date(sale.createdAt).getTime() < Date.now() - ACCESS_WINDOW_MS;
};

// ============================================================
// CREATE OLDER-SALE ACCESS REQUEST
// ============================================================

exports.createRequest = async (req, res) => {
  try {
    const saleType = String(req.body.saleType || "").toLowerCase();
    const Model = getModel(saleType);

    const identifierType = getIdentifierType(
      req.body.identifierType ||
        (req.body.invoiceNumber ? "invoiceNumber" : ""),
    );

    const identifier = String(
      req.body.identifier ?? req.body.invoiceNumber ?? "",
    ).trim();

    const reason = String(req.body.reason || "").trim();

    if (!Model) {
      return res.status(400).json({
        message: "A valid saleType (egg or manure) is required.",
      });
    }

    if (!identifierType || !identifier || !reason) {
      return res.status(400).json({
        message:
          "Choose an identifier type, enter its value, and provide a reason.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        message: "Reason must be 1,000 characters or fewer.",
      });
    }

    if (identifierType === "phone" && !normalizePhone(identifier)) {
      return res.status(400).json({
        message: "Enter a valid customer phone number.",
      });
    }

    const id = requesterId(req);

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(401).json({
        message: "Unable to identify the requesting account.",
      });
    }

    // --------------------------------------------------------
    // VALIDATE THE SELECTED CUSTOMER
    // --------------------------------------------------------

    let selectedCustomer = null;
    let searchIdentifier = identifier;
    let customerPhone = String(req.body.customerPhone || "").trim();
    let customerId = null;

    if (identifierType === "customerName" && req.body.customerId) {
      if (!mongoose.isValidObjectId(req.body.customerId)) {
        return res.status(400).json({
          message: "The selected customer ID is invalid.",
        });
      }

      selectedCustomer = await Customer.findOne({
        _id: req.body.customerId,
        isDeleted: false,
        isActive: true,
      }).lean();

      if (!selectedCustomer) {
        return res.status(404).json({
          message:
            "The selected customer was not found or is no longer active. Search for the customer again.",
        });
      }

      // Use the authoritative customer record, not an untrusted
      // name or phone supplied by the browser.
      if (
        selectedCustomer.name.trim().toLowerCase() !== identifier.toLowerCase()
      ) {
        return res.status(400).json({
          message:
            "The selected customer does not match the entered name. Select the customer again.",
        });
      }

      searchIdentifier = selectedCustomer.name.trim();
      customerPhone = selectedCustomer.phone || "";
      customerId = selectedCustomer._id;
    }

    if (
      identifierType === "customerName" &&
      !selectedCustomer &&
      !searchIdentifier
    ) {
      return res.status(400).json({
        message: "Select a valid customer.",
      });
    }

    // --------------------------------------------------------
    // FIND THE SALE OR VERIFY THE SELECTED INVOICE
    // --------------------------------------------------------

    const search = buildSaleSearch({
      identifierType,
      identifier: searchIdentifier,
      saleType,
      customerId,
      customerPhone,
    });

    if (!search) {
      return res.status(400).json({
        message: "The supplied search identifier is invalid.",
      });
    }

    let sale;

    // The frontend sends saleId after the manager chooses one
    // from the multiple-matching-invoices list.
    if (req.body.saleId) {
      if (!mongoose.isValidObjectId(req.body.saleId)) {
        return res.status(400).json({
          message: "The selected sale ID is invalid.",
        });
      }

      sale = await Model.findOne({
        _id: req.body.saleId,
        isDeleted: false,
        ...search,
      }).lean();

      if (!sale) {
        return res.status(404).json({
          message:
            "The selected invoice does not match the search details or no longer exists. Search again and select a valid invoice.",
        });
      }

      if (!isOlderThanAccessWindow(sale)) {
        return res.status(400).json({
          message: "Only sales older than 24 hours require an access request.",
        });
      }
    } else {
      const matchingSales = await Model.find({
        ...search,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!matchingSales.length) {
        return res.status(404).json({
          message:
            "No active sale matched those details. Check the details and try again.",
        });
      }

      const olderSales = matchingSales.filter(isOlderThanAccessWindow);

      if (!olderSales.length) {
        return res.status(400).json({
          message:
            "The matching sale is still within the normal 24-hour access window.",
        });
      }

      if (olderSales.length > 1) {
        return res.status(409).json({
          code: "MULTIPLE_SALES_MATCHED",
          message:
            "Multiple older sales match those details. Select the correct invoice before requesting access.",
          matches: olderSales.map(saleSummary),
        });
      }

      sale = olderSales[0];
    }

    // --------------------------------------------------------
    // CHECK FOR EXISTING ACTIVE ACCESS
    // --------------------------------------------------------

    const existingGrant = await SaleAccessRequest.findOne({
      saleType,
      saleId: sale._id,
      requesterId: id,
      status: "approved",
      accessExpiresAt: { $gt: new Date() },
    });

    if (existingGrant) {
      return res.json({
        message: "You already have active temporary access to this sale.",
        request: existingGrant,
      });
    }

    // --------------------------------------------------------
    // CHECK FOR AN EXISTING PENDING REQUEST
    // --------------------------------------------------------

    const pending = await SaleAccessRequest.findOne({
      saleType,
      saleId: sale._id,
      requesterId: id,
      status: "pending",
    });

    if (pending) {
      return res.status(409).json({
        message: "You already have a pending request for this invoice.",
        request: pending,
      });
    }

    // --------------------------------------------------------
    // CREATE THE REQUEST
    // --------------------------------------------------------

    const request = await SaleAccessRequest.create({
      saleType,
      saleId: sale._id,
      invoiceNumber: sale.invoiceNumber || "",
      requesterId: id,
      requesterName: requesterName(req),
      reason,
      requesterViewedAt: null,
    });

    const payload = {
      _id: request._id.toString(),
      saleType: request.saleType,
      saleId: request.saleId.toString(),
      invoiceNumber: request.invoiceNumber,
      requesterId: request.requesterId.toString(),
      requesterName: request.requesterName,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    };

    emitSocketEvent(
      req,
      "role:superadmin",
      "saleAccessRequestCreated",
      payload,
    );

    return res.status(201).json({
      message: "Older-sale access request submitted for superadmin review.",
      request,
    });
  } catch (err) {
    console.error("Create sale access request error:", err);

    return res.status(500).json({
      message: err.message || "Failed to submit access request.",
    });
  }
};

// ============================================================
// GET ACCESS REQUESTS
// ============================================================

exports.getRequests = async (req, res) => {
  try {
    const filter = {};

    if (req.query.saleType) {
      const saleType = String(req.query.saleType).toLowerCase();

      if (!["egg", "manure"].includes(saleType)) {
        return res.status(400).json({
          message: "Invalid saleType.",
        });
      }

      filter.saleType = saleType;
    }

    if (req.user?.role !== "superadmin") {
      const id = requesterId(req);

      if (!id) {
        return res.status(401).json({
          message: "Unable to identify the requesting account.",
        });
      }

      filter.requesterId = id;
    }

    if (req.query.status) {
      if (!["pending", "approved", "rejected"].includes(req.query.status)) {
        return res.status(400).json({
          message: "Invalid status.",
        });
      }

      filter.status = req.query.status;
    }

    const requests = await SaleAccessRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("requesterId", "name email role")
      .populate("reviewedBy", "name email role")
      .lean();

    return res.json(requests);
  } catch (err) {
    console.error("Get sale access requests error:", err);

    return res.status(500).json({
      message: err.message || "Failed to retrieve access requests.",
    });
  }
};

// ============================================================
// SUPERADMIN REVIEWS REQUEST
// ============================================================

exports.reviewRequest = async (req, res) => {
  try {
    // Keep a controller-level role check as well as route protection.
    if (req.user?.role !== "superadmin") {
      return res.status(403).json({
        message: "Only a superadmin can review access requests.",
      });
    }

    const decision = String(req.body.decision || "").toLowerCase();

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        message: "Decision must be approved or rejected.",
      });
    }

    const reviewerId = requesterId(req);

    if (!reviewerId) {
      return res.status(401).json({
        message: "Unable to identify the reviewing account.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid request ID.",
      });
    }

    const request = await SaleAccessRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        message: "Access request not found.",
      });
    }

    if (request.status !== "pending") {
      return res.status(409).json({
        message: `This request has already been ${request.status}.`,
      });
    }

    const Model = getModel(request.saleType);

    if (!Model) {
      return res.status(400).json({
        message: "The request contains an invalid sale type.",
      });
    }

    const sale = await Model.findById(request.saleId);

    if (!sale || sale.isDeleted) {
      return res.status(404).json({
        message: "The requested sale no longer exists or has been deleted.",
      });
    }

    request.status = decision;
    request.reviewedBy = reviewerId;
    request.reviewedByName = requesterName(req);
    request.reviewedAt = new Date();

    request.reviewNote = String(req.body.reviewNote || "")
      .trim()
      .slice(0, 1000);

    request.accessExpiresAt =
      decision === "approved"
        ? new Date(Date.now() + ACCESS_DURATION_MS)
        : null;

    request.requesterViewedAt = null;

    await request.save();

    const payload = {
      _id: request._id.toString(),
      saleType: request.saleType,
      saleId: request.saleId.toString(),
      invoiceNumber: request.invoiceNumber,
      requesterId: request.requesterId.toString(),
      requesterName: request.requesterName,
      status: request.status,
      reviewedBy: request.reviewedBy?.toString() || null,
      reviewedByName: request.reviewedByName,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      accessExpiresAt: request.accessExpiresAt,
      requesterViewedAt: request.requesterViewedAt,
    };

    emitSocketEvent(
      req,
      `admin:${request.requesterId.toString()}`,
      "saleAccessRequestReviewed",
      payload,
    );

    return res.json({
      message:
        decision === "approved"
          ? "Request approved. Access expires in two hours."
          : "Request rejected.",
      request,
    });
  } catch (err) {
    console.error("Review sale access request error:", err);

    return res.status(500).json({
      message: err.message || "Failed to review access request.",
    });
  }
};

// ============================================================
// MANAGER MARKS THEIR OWN DECISION AS VIEWED
// ============================================================

exports.markViewed = async (req, res) => {
  try {
    const id = requesterId(req);

    if (!id) {
      return res.status(401).json({
        message: "Unable to identify the requesting account.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid request ID.",
      });
    }

    const request = await SaleAccessRequest.findOne({
      _id: req.params.id,
      requesterId: id,
      status: { $in: ["approved", "rejected"] },
    });

    if (!request) {
      return res.status(404).json({
        message: "Reviewed access request not found.",
      });
    }

    if (!request.requesterViewedAt) {
      request.requesterViewedAt = new Date();
      await request.save();
    }

    return res.json({
      message: "Access-request notification marked as viewed.",
      request,
    });
  } catch (err) {
    console.error("Mark sale access request viewed error:", err);

    return res.status(500).json({
      message: err.message || "Failed to mark notification as viewed.",
    });
  }
};

/* ============================================================
   DELETE SALE-ACCESS REQUEST

   Managers: delete their own pending requests only.
   Superadmins: delete requests in any status.
============================================================ */

exports.deleteRequest = async (req, res) => {
  try {
    const id = requesterId(req);

    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(401).json({
        message: "Unable to identify the requesting account.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid access-request ID.",
      });
    }

    const isSuperadmin = req.user?.role === "superadmin";

    // Managers can only target their own pending requests.
    const filter = {
      _id: req.params.id,
    };

    if (!isSuperadmin) {
      filter.requesterId = id;
      filter.status = "pending";
    }

    // Atomic deletion ensures the ownership and status restrictions
    // are applied as part of the database operation.
    const deletedRequest = await SaleAccessRequest.findOneAndDelete(filter);

    if (!deletedRequest) {
      // Avoid revealing whether another manager's request exists.
      return res.status(404).json({
        message: isSuperadmin
          ? "Access request not found."
          : "Pending access request not found, or you do not have permission to delete it.",
      });
    }

    const payload = {
      _id: deletedRequest._id.toString(),
      saleType: deletedRequest.saleType,
      saleId: deletedRequest.saleId.toString(),
      invoiceNumber: deletedRequest.invoiceNumber || "",
      requesterId: deletedRequest.requesterId.toString(),
      status: deletedRequest.status,
      deletedBy: id.toString(),
      deletedAt: new Date(),
    };

    // Notify the requester and superadmins so their request lists
    // can be refreshed by clients listening to these events.
    emitSocketEvent(
      req,
      `admin:${deletedRequest.requesterId.toString()}`,
      "saleAccessRequestDeleted",
      payload,
    );

    emitSocketEvent(
      req,
      "role:superadmin",
      "saleAccessRequestDeleted",
      payload,
    );

    return res.json({
      message: "Sale-access request deleted successfully.",
      deletedRequest: payload,
    });
  } catch (err) {
    console.error("Delete sale access request error:", err);

    return res.status(500).json({
      message: err.message || "Failed to delete access request.",
    });
  }
};
