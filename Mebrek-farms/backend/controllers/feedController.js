const mongoose = require("mongoose");

const Feed = require("../models/Feed");
const FeedTransaction = require("../models/FeedTransaction");
const FeedChangeRequest = require("../models/FeedChangeRequest");
const Admin = require("../models/Admin");

const { logAudit } = require("../utils/auditLogger");

// ============================================================
// HELPERS
// ============================================================

const getRequesterId = (req) =>
  req.user?.id || req.user?._id || req.admin?.id || req.admin?._id || null;

const getUserRole = (req) =>
  String(req.user?.role || req.admin?.role || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");

const isSuperadmin = (req) => getUserRole(req) === "superadmin";
const isManager = (req) => getUserRole(req) === "manager";

const getFeedName = (feed) => feed?.name || "Unknown feed";

const getFeedAuditSnapshot = (feed) => {
  if (!feed) return null;

  const snapshot = feed.toObject ? feed.toObject() : { ...feed };

  delete snapshot.__v;

  return snapshot;
};

const emitFeedEvent = (req, event, payload) => {
  try {
    const io = req.app?.get("io");

    if (io) {
      io.emit(event, payload);
    }
  } catch (error) {
    console.error("Feed socket event error:", error.message);
  }
};

const sendError = (res, status, message) =>
  res.status(status).json({
    success: false,
    message,
  });

const isValidPositiveNumber = (value) =>
  Number.isFinite(Number(value)) && Number(value) > 0;

const isValidNonNegativeNumber = (value) =>
  Number.isFinite(Number(value)) && Number(value) >= 0;

// Signed stock adjustment:
// Positive = increase
// Negative = decrease
// Zero = invalid

const isValidStockAdjustment = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) !== 0;

const FEED_DETAIL_FIELDS = [
  "name",
  "unit",
  "supplier",
  "lowStockThreshold",
  "purchaseDate",
  "expiryDate",
];

const sanitizeFeedDetails = (changes = {}) => {
  const sanitized = {};

  for (const field of FEED_DETAIL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(changes, field)) {
      sanitized[field] = changes[field];
    }
  }

  return sanitized;
};

const getChangedFields = (before, after) => {
  const changed = {};

  for (const key of Object.keys(after || {})) {
    if (String(before?.[key] ?? "") !== String(after[key] ?? "")) {
      changed[key] = {
        before: before?.[key] ?? null,
        after: after[key],
      };
    }
  }

  return changed;
};

// ============================================================
// CREATE FEED
// SUPERADMIN + MANAGER
// ============================================================

exports.createFeed = async (req, res) => {
  if (!isSuperadmin(req) && !isManager(req)) {
    return sendError(
      res,
      403,
      "You are not authorised to create feed inventory records.",
    );
  }

  const {
    name,
    quantity,
    unit,
    supplier,
    lowStockThreshold,
    purchaseDate,
    expiryDate,
  } = req.body;

  if (!name || !String(name).trim()) {
    return sendError(res, 400, "Feed name is required.");
  }

  if (
    quantity === undefined ||
    quantity === null ||
    String(quantity).trim() === "" ||
    !isValidNonNegativeNumber(quantity)
  ) {
    return sendError(
      res,
      400,
      "A valid non-negative opening quantity is required.",
    );
  }

  if (
    lowStockThreshold !== undefined &&
    !isValidNonNegativeNumber(lowStockThreshold)
  ) {
    return sendError(res, 400, "Low stock threshold must be zero or greater.");
  }

  const validUnits = ["bags", "kg", "tonnes"];
  const selectedUnit = String(unit || "bags").toLowerCase();

  if (!validUnits.includes(selectedUnit)) {
    return sendError(res, 400, "Invalid feed measurement unit.");
  }

  const parsedPurchaseDate = purchaseDate ? new Date(purchaseDate) : new Date();

  const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;

  if (Number.isNaN(parsedPurchaseDate.getTime())) {
    return sendError(res, 400, "Invalid purchase date.");
  }

  if (parsedExpiryDate && Number.isNaN(parsedExpiryDate.getTime())) {
    return sendError(res, 400, "Invalid expiry date.");
  }

  if (parsedExpiryDate && parsedExpiryDate < parsedPurchaseDate) {
    return sendError(
      res,
      400,
      "Expiry date cannot be earlier than purchase date.",
    );
  }

  const session = await mongoose.startSession();

  try {
    let feed;
    let openingTransaction = null;

    await session.withTransaction(async () => {
      const createdFeeds = await Feed.create(
        [
          {
            name: String(name).trim(),
            quantity: Number(quantity),
            unit: selectedUnit,
            supplier: String(supplier || "").trim(),
            lowStockThreshold:
              lowStockThreshold === undefined ? 5 : Number(lowStockThreshold),
            purchaseDate: parsedPurchaseDate,
            expiryDate: parsedExpiryDate,
          },
        ],
        { session },
      );

      feed = createdFeeds[0];

      if (Number(quantity) > 0) {
        const transactions = await FeedTransaction.create(
          [
            {
              feed: feed._id,
              production: null,
              pen: null,
              transactionType: "PURCHASE",
              quantity: Number(quantity),
              stockBefore: 0,
              stockAfter: Number(quantity),
              unit: selectedUnit,
              transactionDate: parsedPurchaseDate,
              remarks: "Opening feed inventory balance.",
              createdBy: getRequesterId(req),
            },
          ],
          { session },
        );

        openingTransaction = transactions[0];
      }
    });

    await logAudit(req, {
      action: "CREATE",
      module: "Feed Inventory",
      description: `Created feed inventory record: ${feed.name}`,
      entityId: feed._id,
      entityName: feed.name,
      before: null,
      after: getFeedAuditSnapshot(feed),
      metadata: {
        openingQuantity: Number(quantity),
        openingTransactionId: openingTransaction?._id || null,
      },
    });

    emitFeedEvent(req, "feedCreated", feed);

    return res.status(201).json({
      success: true,
      message: "Feed inventory record created successfully.",
      feed,
      transaction: openingTransaction,
    });
  } catch (error) {
    console.error("Create feed error:", error);

    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Unable to create feed inventory record.",
    );
  } finally {
    await session.endSession();
  }
};

// ============================================================
// GET FEEDS
// SUPERADMIN + MANAGER
// ============================================================

exports.getFeeds = async (req, res) => {
  try {
    if (!isSuperadmin(req) && !isManager(req)) {
      return sendError(
        res,
        403,
        "You are not authorised to view feed inventory.",
      );
    }

    const filter = isSuperadmin(req) ? {} : { isDeleted: false };

    const feeds = await Feed.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: feeds.length,
      feeds,
    });
  } catch (error) {
    console.error("Get feeds error:", error);

    return sendError(res, 500, "Unable to retrieve feed inventory.");
  }
};

// ============================================================
// UPDATE FEED DETAILS
// SUPERADMIN ONLY
// ============================================================

exports.updateFeed = async (req, res) => {
  try {
    if (!isSuperadmin(req)) {
      return sendError(
        res,
        403,
        "Only the superadmin can directly edit feed records.",
      );
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid feed ID.");
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "quantity") ||
      Object.prototype.hasOwnProperty.call(req.body, "pricePerUnit")
    ) {
      return sendError(
        res,
        400,
        "Stock quantity must be changed through stock adjustment. Feed pricing is not supported.",
      );
    }

    const changes = sanitizeFeedDetails(req.body);

    if (!Object.keys(changes).length) {
      return sendError(res, 400, "No valid feed detail fields were supplied.");
    }

    if (changes.name !== undefined && !String(changes.name).trim()) {
      return sendError(res, 400, "Feed name cannot be empty.");
    }

    if (
      changes.lowStockThreshold !== undefined &&
      !isValidNonNegativeNumber(changes.lowStockThreshold)
    ) {
      return sendError(
        res,
        400,
        "Low stock threshold must be zero or greater.",
      );
    }

    if (changes.unit !== undefined) {
      const validUnits = ["bags", "kg", "tonnes"];

      if (!validUnits.includes(String(changes.unit).toLowerCase())) {
        return sendError(res, 400, "Invalid feed measurement unit.");
      }

      changes.unit = String(changes.unit).toLowerCase();
    }

    if (changes.purchaseDate !== undefined) {
      const date = new Date(changes.purchaseDate);

      if (Number.isNaN(date.getTime())) {
        return sendError(res, 400, "Invalid purchase date.");
      }

      changes.purchaseDate = date;
    }

    if (changes.expiryDate !== undefined) {
      if (changes.expiryDate === null || changes.expiryDate === "") {
        changes.expiryDate = null;
      } else {
        const date = new Date(changes.expiryDate);

        if (Number.isNaN(date.getTime())) {
          return sendError(res, 400, "Invalid expiry date.");
        }

        changes.expiryDate = date;
      }
    }

    const feed = await Feed.findById(id);

    if (!feed) {
      return sendError(res, 404, "Feed record not found.");
    }

    if (feed.isDeleted) {
      return sendError(res, 400, "Deleted feed records cannot be edited.");
    }

    const before = getFeedAuditSnapshot(feed);

    Object.assign(feed, changes);

    if (
      feed.expiryDate &&
      feed.purchaseDate &&
      feed.expiryDate < feed.purchaseDate
    ) {
      return sendError(
        res,
        400,
        "Expiry date cannot be earlier than purchase date.",
      );
    }

    await feed.save();

    const after = getFeedAuditSnapshot(feed);

    await logAudit(req, {
      action: "UPDATE",
      module: "Feed Inventory",
      description: `Updated feed details: ${feed.name}`,
      entityId: feed._id,
      entityName: feed.name,
      before,
      after,
      metadata: {
        changedFields: getChangedFields(before, after),
      },
    });

    emitFeedEvent(req, "feedUpdated", feed);

    return res.status(200).json({
      success: true,
      message: "Feed details updated successfully.",
      feed,
    });
  } catch (error) {
    console.error("Update feed error:", error);

    return sendError(
      res,
      500,
      error.message || "Unable to update feed details.",
    );
  }
};

// ============================================================
// ADJUST FEED STOCK
// SUPERADMIN ONLY
//
// Positive quantity = add stock
// Negative quantity = remove stock
// Zero is invalid
// ============================================================

exports.adjustFeedStock = async (req, res) => {
  if (!isSuperadmin(req)) {
    return sendError(
      res,
      403,
      "Only the superadmin can directly adjust feed stock.",
    );
  }

  const { id } = req.params;
  const { quantity, remarks, transactionDate } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 400, "Invalid feed ID.");
  }

  if (!isValidStockAdjustment(quantity)) {
    return sendError(
      res,
      400,
      "Enter a non-zero positive or negative adjustment quantity.",
    );
  }

  const adjustment = Number(quantity);

  if (adjustment < 0 && !String(remarks || "").trim()) {
    return sendError(
      res,
      400,
      "Remarks are required when reducing feed stock.",
    );
  }

  const parsedDate = transactionDate ? new Date(transactionDate) : new Date();

  if (Number.isNaN(parsedDate.getTime())) {
    return sendError(res, 400, "Invalid transaction date.");
  }

  const session = await mongoose.startSession();

  try {
    let updatedFeed;
    let transaction;
    let stockBefore;
    let stockAfter;

    await session.withTransaction(async () => {
      const feed = await Feed.findById(id).session(session);

      if (!feed) {
        const error = new Error("Feed record not found.");
        error.statusCode = 404;
        throw error;
      }

      if (feed.isDeleted) {
        const error = new Error("Deleted feed records cannot be adjusted.");
        error.statusCode = 400;
        throw error;
      }

      stockBefore = Number(feed.quantity);
      stockAfter = stockBefore + adjustment;

      if (stockAfter < 0) {
        const error = new Error(
          `Insufficient stock. Available quantity: ${stockBefore} ${feed.unit}.`,
        );
        error.statusCode = 400;
        throw error;
      }

      const stockFilter = {
        _id: feed._id,
        isDeleted: false,
        quantity:
          adjustment < 0
            ? {
                $eq: stockBefore,
                $gte: Math.abs(adjustment),
              }
            : stockBefore,
      };

      updatedFeed = await Feed.findOneAndUpdate(
        stockFilter,
        {
          $inc: {
            quantity: adjustment,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!updatedFeed) {
        const error = new Error(
          "Feed stock changed while this adjustment was being processed. Refresh and try again.",
        );
        error.statusCode = 409;
        throw error;
      }

      const transactions = await FeedTransaction.create(
        [
          {
            feed: feed._id,
            production: null,
            pen: null,
            transactionType: "ADJUSTMENT",
            quantity: Math.abs(adjustment),
            stockBefore,
            stockAfter,
            unit: feed.unit,
            transactionDate: parsedDate,
            remarks: String(remarks || "").trim(),
            createdBy: getRequesterId(req),
          },
        ],
        { session },
      );

      transaction = transactions[0];
    });

    await logAudit(req, {
      action: "STOCK_ADJUSTMENT",
      module: "Feed Inventory",
      description: `${
        adjustment > 0 ? "Added" : "Removed"
      } ${Math.abs(adjustment)} ${updatedFeed.unit} of ${updatedFeed.name}`,
      entityId: updatedFeed._id,
      entityName: updatedFeed.name,
      before: { quantity: stockBefore },
      after: { quantity: stockAfter },
      metadata: {
        adjustment,
        direction: adjustment > 0 ? "ADD" : "REMOVE",
        remarks: String(remarks || "").trim(),
        transactionId: transaction?._id,
      },
    });

    emitFeedEvent(req, "feedUpdated", updatedFeed);

    return res.status(200).json({
      success: true,
      message: "Feed stock adjusted successfully.",
      feed: updatedFeed,
      transaction,
      stockBefore,
      stockAfter,
    });
  } catch (error) {
    console.error("Adjust feed stock error:", error);

    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Unable to adjust feed stock.",
    );
  } finally {
    await session.endSession();
  }
};

// ============================================================
// DELETE FEED
// SUPERADMIN ONLY
// SOFT DELETE
// ============================================================

exports.deleteFeed = async (req, res) => {
  try {
    if (!isSuperadmin(req)) {
      return sendError(
        res,
        403,
        "Only the superadmin can delete feed inventory records.",
      );
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid feed ID.");
    }

    const feed = await Feed.findById(id);

    if (!feed) {
      return sendError(res, 404, "Feed record not found.");
    }

    if (feed.isDeleted) {
      return sendError(res, 400, "This feed record has already been deleted.");
    }

    const before = getFeedAuditSnapshot(feed);

    const adminId = getRequesterId(req);

    const admin = adminId ? await Admin.findById(adminId).select("role") : null;

    feed.isDeleted = true;
    feed.deletedAt = new Date();
    feed.deletedBy = adminId;
    feed.deletedByRole = admin?.role || getUserRole(req);

    await feed.save();

    await logAudit(req, {
      action: "DELETE",
      module: "Feed Inventory",
      description: `Soft-deleted feed inventory record: ${feed.name}`,
      entityId: feed._id,
      entityName: feed.name,
      before,
      after: getFeedAuditSnapshot(feed),
    });

    emitFeedEvent(req, "feedDeleted", {
      _id: feed._id,
      name: feed.name,
      isDeleted: true,
    });

    return res.status(200).json({
      success: true,
      message: "Feed inventory record deleted successfully.",
      feed,
    });
  } catch (error) {
    console.error("Delete feed error:", error);

    return sendError(
      res,
      500,
      error.message || "Unable to delete feed record.",
    );
  }
};

// ============================================================
// SUBMIT FEED CHANGE REQUEST
// MANAGER ONLY
//
// DETAILS_UPDATE:
// Manager requests feed detail changes.
//
// STOCK_ADJUSTMENT:
// Positive quantity = request stock increase.
// Negative quantity = request stock decrease.
//
// Inventory changes only after approval.
// ============================================================

exports.submitFeedChangeRequest = async (req, res) => {
  try {
    if (!isManager(req)) {
      return sendError(
        res,
        403,
        "Only managers can submit feed change requests.",
      );
    }

    const { id } = req.params;

    const { requestType, requestedChanges, requestRemarks } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid feed ID.");
    }

    if (!["DETAILS_UPDATE", "STOCK_ADJUSTMENT"].includes(requestType)) {
      return sendError(res, 400, "Invalid request type.");
    }

    const feed = await Feed.findById(id);

    if (!feed) {
      return sendError(res, 404, "Feed record not found.");
    }

    if (feed.isDeleted) {
      return sendError(
        res,
        400,
        "You cannot submit a request for a deleted feed record.",
      );
    }

    let sanitizedChanges = {};

    // ------------------------------------------
    // DETAILS UPDATE REQUEST
    // ------------------------------------------

    if (requestType === "DETAILS_UPDATE") {
      sanitizedChanges = sanitizeFeedDetails(requestedChanges);

      if (!Object.keys(sanitizedChanges).length) {
        return sendError(
          res,
          400,
          "Provide at least one valid feed detail to change.",
        );
      }

      if (
        sanitizedChanges.name !== undefined &&
        !String(sanitizedChanges.name).trim()
      ) {
        return sendError(res, 400, "Feed name cannot be empty.");
      }

      if (
        sanitizedChanges.lowStockThreshold !== undefined &&
        !isValidNonNegativeNumber(sanitizedChanges.lowStockThreshold)
      ) {
        return sendError(
          res,
          400,
          "Low stock threshold must be zero or greater.",
        );
      }

      if (sanitizedChanges.unit !== undefined) {
        const validUnits = ["bags", "kg", "tonnes"];

        sanitizedChanges.unit = String(sanitizedChanges.unit).toLowerCase();

        if (!validUnits.includes(sanitizedChanges.unit)) {
          return sendError(res, 400, "Invalid feed measurement unit.");
        }
      }
    }

    // ------------------------------------------
    // SIGNED STOCK ADJUSTMENT REQUEST
    // ------------------------------------------

    if (requestType === "STOCK_ADJUSTMENT") {
      const adjustment = requestedChanges?.quantity;

      if (!isValidStockAdjustment(adjustment)) {
        return sendError(
          res,
          400,
          "Enter a non-zero positive or negative adjustment quantity.",
        );
      }

      const signedAdjustment = Number(adjustment);

      if (signedAdjustment < 0 && !String(requestRemarks || "").trim()) {
        return sendError(
          res,
          400,
          "Remarks are required when requesting a stock reduction.",
        );
      }

      sanitizedChanges = {
        quantity: signedAdjustment,
      };
    }

    const changeRequest = await FeedChangeRequest.create({
      feed: feed._id,
      requestType,
      requestedChanges: sanitizedChanges,
      requestRemarks: String(requestRemarks || "").trim(),
      requestedBy: getRequesterId(req),
      status: "PENDING",
    });

    await changeRequest.populate([
      {
        path: "feed",
        select: "name quantity unit isDeleted",
      },
      {
        path: "requestedBy",
        select: "name email role",
      },
    ]);

    await logAudit(req, {
      action: "CREATE",
      module: "Feed Change Requests",
      description: `Submitted ${requestType} request for ${getFeedName(feed)}`,
      entityId: changeRequest._id,
      entityName: getFeedName(feed),
      before: null,
      after: changeRequest.toObject(),
      metadata: {
        feedId: feed._id,
        requestType,
        requestedChanges: sanitizedChanges,
      },
    });

    emitFeedEvent(req, "feedChangeRequestCreated", changeRequest);

    return res.status(201).json({
      success: true,
      message: "Feed change request submitted for superadmin approval.",
      request: changeRequest,
    });
  } catch (error) {
    console.error("Submit feed change request error:", error);

    return sendError(
      res,
      500,
      error.message || "Unable to submit feed change request.",
    );
  }
};

// ============================================================
// GET FEED CHANGE REQUESTS
//
// SUPERADMIN: all requests
// MANAGER: only their own requests
// ============================================================

exports.getFeedChangeRequests = async (req, res) => {
  try {
    if (!isSuperadmin(req) && !isManager(req)) {
      return sendError(
        res,
        403,
        "You are not authorised to view feed change requests.",
      );
    }

    const filter = isSuperadmin(req)
      ? {}
      : { requestedBy: getRequesterId(req) };

    const requests = await FeedChangeRequest.find(filter)
      .populate("feed", "name quantity unit isDeleted")
      .populate("requestedBy", "name email role")
      .populate("reviewedBy", "name email role")
      .populate("feedTransaction")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get feed change requests error:", error);

    return sendError(res, 500, "Unable to retrieve feed change requests.");
  }
};

// ============================================================
// APPROVE OR REJECT FEED CHANGE REQUEST
// SUPERADMIN ONLY
//
// APPROVED DETAILS_UPDATE:
// Updates allowed feed detail fields.
//
// APPROVED STOCK_ADJUSTMENT:
// Executes the signed quantity adjustment and creates
// a FeedTransaction record.
//
// REJECTED:
// Does not alter inventory.
// ============================================================

exports.reviewFeedChangeRequest = async (req, res) => {
  if (!isSuperadmin(req)) {
    return sendError(
      res,
      403,
      "Only the superadmin can review feed change requests.",
    );
  }

  const { requestId } = req.params;

  const decision = String(req.body.decision || "").toUpperCase();

  const reviewRemarks = String(req.body.reviewRemarks || "").trim();

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return sendError(res, 400, "Invalid request ID.");
  }

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return sendError(res, 400, "Decision must be APPROVED or REJECTED.");
  }

  const session = await mongoose.startSession();

  try {
    let reviewedRequest;
    let updatedFeed = null;
    let transaction = null;

    let beforeFeed = null;
    let afterFeed = null;

    let stockBefore = null;
    let stockAfter = null;

    await session.withTransaction(async () => {
      const changeRequest =
        await FeedChangeRequest.findById(requestId).session(session);

      if (!changeRequest) {
        const error = new Error("Feed change request not found.");
        error.statusCode = 404;
        throw error;
      }

      if (changeRequest.status !== "PENDING") {
        const error = new Error(
          `This request has already been ${changeRequest.status.toLowerCase()}.`,
        );
        error.statusCode = 400;
        throw error;
      }

      const requestBefore = changeRequest.toObject();

      // ------------------------------------------
      // REJECT REQUEST
      // ------------------------------------------

      if (decision === "REJECTED") {
        changeRequest.status = "REJECTED";
        changeRequest.reviewedBy = getRequesterId(req);
        changeRequest.reviewedAt = new Date();
        changeRequest.reviewRemarks = reviewRemarks;

        await changeRequest.save({ session });

        reviewedRequest = changeRequest;
        reviewedRequest._requestBefore = requestBefore;

        return;
      }

      // ------------------------------------------
      // LOAD FEED
      // ------------------------------------------

      const feed = await Feed.findById(changeRequest.feed).session(session);

      if (!feed) {
        const error = new Error(
          "The feed record associated with this request no longer exists.",
        );
        error.statusCode = 404;
        throw error;
      }

      if (feed.isDeleted) {
        const error = new Error(
          "This request cannot be approved because the feed record has been deleted.",
        );
        error.statusCode = 400;
        throw error;
      }

      beforeFeed = getFeedAuditSnapshot(feed);

      // ------------------------------------------
      // APPROVE DETAIL UPDATE
      // ------------------------------------------

      if (changeRequest.requestType === "DETAILS_UPDATE") {
        const approvedChanges = sanitizeFeedDetails(
          changeRequest.requestedChanges,
        );

        if (!Object.keys(approvedChanges).length) {
          const error = new Error(
            "This request contains no valid feed detail changes.",
          );
          error.statusCode = 400;
          throw error;
        }

        if (
          approvedChanges.name !== undefined &&
          !String(approvedChanges.name).trim()
        ) {
          const error = new Error("The requested feed name cannot be empty.");
          error.statusCode = 400;
          throw error;
        }

        if (
          approvedChanges.lowStockThreshold !== undefined &&
          !isValidNonNegativeNumber(approvedChanges.lowStockThreshold)
        ) {
          const error = new Error(
            "The requested low stock threshold is invalid.",
          );
          error.statusCode = 400;
          throw error;
        }

        if (approvedChanges.unit !== undefined) {
          const validUnits = ["bags", "kg", "tonnes"];

          approvedChanges.unit = String(approvedChanges.unit).toLowerCase();

          if (!validUnits.includes(approvedChanges.unit)) {
            const error = new Error(
              "The requested feed measurement unit is invalid.",
            );
            error.statusCode = 400;
            throw error;
          }
        }

        Object.assign(feed, approvedChanges);

        if (
          feed.expiryDate &&
          feed.purchaseDate &&
          feed.expiryDate < feed.purchaseDate
        ) {
          const error = new Error(
            "Expiry date cannot be earlier than purchase date.",
          );
          error.statusCode = 400;
          throw error;
        }

        await feed.save({ session });

        updatedFeed = feed;
        afterFeed = getFeedAuditSnapshot(feed);
      }

      // ------------------------------------------
      // APPROVE SIGNED STOCK ADJUSTMENT
      // ------------------------------------------

      if (changeRequest.requestType === "STOCK_ADJUSTMENT") {
        const adjustment = changeRequest.requestedChanges?.quantity;

        if (!isValidStockAdjustment(adjustment)) {
          const error = new Error(
            "The stock adjustment request contains an invalid quantity.",
          );
          error.statusCode = 400;
          throw error;
        }

        const signedAdjustment = Number(adjustment);

        if (
          signedAdjustment < 0 &&
          !String(changeRequest.requestRemarks || "").trim()
        ) {
          const error = new Error(
            "Stock reduction requests must contain remarks.",
          );
          error.statusCode = 400;
          throw error;
        }

        stockBefore = Number(feed.quantity);
        stockAfter = stockBefore + signedAdjustment;

        if (stockAfter < 0) {
          const error = new Error(
            `Insufficient current stock. Available quantity: ${stockBefore} ${feed.unit}. This request cannot be approved.`,
          );
          error.statusCode = 400;
          throw error;
        }

        updatedFeed = await Feed.findOneAndUpdate(
          {
            _id: feed._id,
            isDeleted: false,
            quantity:
              signedAdjustment < 0
                ? {
                    $eq: stockBefore,
                    $gte: Math.abs(signedAdjustment),
                  }
                : stockBefore,
          },
          {
            $inc: {
              quantity: signedAdjustment,
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          },
        );

        if (!updatedFeed) {
          const error = new Error(
            "Feed stock changed while this request was being processed. Refresh and review the request again.",
          );
          error.statusCode = 409;
          throw error;
        }

        const transactions = await FeedTransaction.create(
          [
            {
              feed: feed._id,
              production: null,
              pen: null,
              transactionType: "ADJUSTMENT",
              quantity: Math.abs(signedAdjustment),
              stockBefore,
              stockAfter,
              unit: feed.unit,
              transactionDate: new Date(),
              remarks: String(changeRequest.requestRemarks || "").trim(),
              createdBy: getRequesterId(req),
            },
          ],
          { session },
        );

        transaction = transactions[0];

        afterFeed = getFeedAuditSnapshot(updatedFeed);

        changeRequest.stockBefore = stockBefore;
        changeRequest.stockAfter = stockAfter;
        changeRequest.feedTransaction = transaction._id;
        changeRequest.executedAt = new Date();
      }

      // ------------------------------------------
      // COMPLETE APPROVAL
      // ------------------------------------------

      changeRequest.status = "APPROVED";
      changeRequest.reviewedBy = getRequesterId(req);
      changeRequest.reviewedAt = new Date();
      changeRequest.reviewRemarks = reviewRemarks;

      await changeRequest.save({ session });

      reviewedRequest = changeRequest;
      reviewedRequest._requestBefore = requestBefore;
    });

    // ------------------------------------------
    // AUDIT REQUEST REVIEW
    // ------------------------------------------

    await logAudit(req, {
      action: decision,
      module: "Feed Change Requests",
      description: `${
        decision === "APPROVED" ? "Approved" : "Rejected"
      } feed change request ${requestId}`,
      entityId: reviewedRequest._id,
      entityName: updatedFeed?.name || "Feed change request",
      before: reviewedRequest._requestBefore,
      after: reviewedRequest.toObject(),
      metadata: {
        decision,
        requestType: reviewedRequest.requestType,
        feedId: reviewedRequest.feed,
        stockBefore,
        stockAfter,
        transactionId: transaction?._id || null,
        reviewRemarks,
      },
    });

    // ------------------------------------------
    // AUDIT FEED CHANGE
    // ------------------------------------------

    if (updatedFeed) {
      await logAudit(req, {
        action:
          reviewedRequest.requestType === "STOCK_ADJUSTMENT"
            ? "STOCK_ADJUSTMENT_APPROVED"
            : "UPDATE",
        module: "Feed Inventory",
        description: `Feed change request ${decision.toLowerCase()}: ${updatedFeed.name}`,
        entityId: updatedFeed._id,
        entityName: updatedFeed.name,
        before: beforeFeed,
        after: afterFeed,
        metadata: {
          requestId: reviewedRequest._id,
          requestType: reviewedRequest.requestType,
          stockBefore,
          stockAfter,
          transactionId: transaction?._id || null,
        },
      });

      emitFeedEvent(req, "feedUpdated", updatedFeed);
    }

    await reviewedRequest.populate([
      {
        path: "feed",
        select: "name quantity unit isDeleted",
      },
      {
        path: "requestedBy",
        select: "name email role",
      },
      {
        path: "reviewedBy",
        select: "name email role",
      },
      {
        path: "feedTransaction",
      },
    ]);

    emitFeedEvent(req, "feedChangeRequestReviewed", reviewedRequest);

    return res.status(200).json({
      success: true,
      message:
        decision === "APPROVED"
          ? "Feed change request approved and executed successfully."
          : "Feed change request rejected successfully.",
      request: reviewedRequest,
      feed: updatedFeed,
      transaction,
      stockBefore,
      stockAfter,
    });
  } catch (error) {
    console.error("Review feed change request error:", error);

    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Unable to review feed change request.",
    );
  } finally {
    await session.endSession();
  }
};
