const mongoose = require("mongoose");
const SaleAccessRequest = require("../models/SaleAccessRequest");
const EggSale = require("../models/EggSale");
const ManureSale = require("../models/ManureSale");

const ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACCESS_DURATION_MS = 2 * 60 * 60 * 1000;

const requesterId = (req) => req.user?.id || req.user?._id || null;
const requesterName = (req) => req.user?.name || req.user?.adminName || "";

const getModel = (type) =>
  type === "egg" ? EggSale : type === "manure" ? ManureSale : null;

const emitSocketEvent = (req, room, eventName, payload) => {
  const io = req.app.get("io");

  if (!io) {
    console.warn(`Socket.IO unavailable; could not emit ${eventName}`);
    return;
  }

  io.to(room).emit(eventName, payload);
};

// CREATE OLDER-SALE ACCESS REQUEST
exports.createRequest = async (req, res) => {
  try {
    const saleType = String(req.body.saleType || "").toLowerCase();
    const invoiceNumber = String(req.body.invoiceNumber || "").trim();
    const reason = String(req.body.reason || "").trim();
    const Model = getModel(saleType);

    if (!Model || !invoiceNumber || !reason) {
      return res.status(400).json({
        message: "saleType, invoiceNumber and reason are required.",
      });
    }

    if (reason.length > 1000) {
      return res.status(400).json({
        message: "Reason must be 1,000 characters or fewer.",
      });
    }

    const id = requesterId(req);

    if (!id) {
      return res.status(401).json({
        message: "Unable to identify the requesting account.",
      });
    }

    const sale = await Model.findOne({ invoiceNumber, isDeleted: false });

    if (!sale) {
      return res.status(404).json({
        message: "An active sale with that invoice number was not found.",
      });
    }

    if (new Date(sale.createdAt).getTime() >= Date.now() - ACCESS_WINDOW_MS) {
      return res.status(400).json({
        message: "This sale is still within the normal 24-hour access window.",
      });
    }

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

    const request = await SaleAccessRequest.create({
      saleType,
      saleId: sale._id,
      invoiceNumber: sale.invoiceNumber,
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

// GET ACCESS REQUESTS
exports.getRequests = async (req, res) => {
  try {
    const filter = {};

    if (req.query.saleType) {
      const saleType = String(req.query.saleType).toLowerCase();

      if (!["egg", "manure"].includes(saleType)) {
        return res.status(400).json({ message: "Invalid saleType." });
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
        return res.status(400).json({ message: "Invalid status." });
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

// SUPERADMIN REVIEWS REQUEST
exports.reviewRequest = async (req, res) => {
  try {
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
      return res.status(400).json({ message: "Invalid request ID." });
    }

    const request = await SaleAccessRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Access request not found." });
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

    // Each decision starts unread for the manager.
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

// MANAGER MARKS THEIR OWN DECISION AS VIEWED
exports.markViewed = async (req, res) => {
  try {
    const id = requesterId(req);

    if (!id) {
      return res.status(401).json({
        message: "Unable to identify the requesting account.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid request ID." });
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
