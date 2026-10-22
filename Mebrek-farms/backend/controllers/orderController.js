const mongoose = require("mongoose");
const Order = require("../models/Order");
const OrderCounter = require("../models/OrderCounter");
const Customer = require("../models/Customer");
const {
  isTermiiConfigured,
  sendTermiiSMS,
} = require("../services/termiiService");

const ORDER_STATUSES = ["Pending", "Contacted", "Completed", "Cancelled"];
const CONTACT_STATUSES = [
  "Not Scheduled",
  "Scheduled",
  "Contacted",
  "No Answer",
  "Reschedule",
  "Completed",
];

const getAdmin = (req) => req.admin || req.user || {};
const getAdminId = (req) => getAdmin(req)._id || getAdmin(req).id || null;

async function nextBookingNumber() {
  const counter = await OrderCounter.findOneAndUpdate(
    { _id: "orders" },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return counter.sequence;
}

function emitOrder(req, event, payload) {
  const io = req.app.get("io");
  if (io) io.emit(event, payload);
}

function combineNameContact(body, customer) {
  return {
    name: String(body.name || customer?.name || "").trim(),
    contact: String(body.contact || customer?.phone || "").trim(),
  };
}

function normalizeNigerianPhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (phone.startsWith("+")) phone = phone.slice(1);

  if (/^0\d{10}$/.test(phone)) {
    phone = `234${phone.slice(1)}`;
  }

  return /^234\d{10}$/.test(phone) ? phone : null;
}

async function sendOrderConfirmationSMS(order) {
  if (!isTermiiConfigured()) {
    console.log("Order confirmation SMS skipped: Termii is not configured.");
    return;
  }

  const phone = normalizeNigerianPhone(order.contact);

  if (!phone) {
    console.warn("Order confirmation SMS skipped: invalid phone number.");
    return;
  }

  const bookingNumber = `MF-${String(order.bookingNumber).padStart(5, "0")}`;

  try {
    await sendTermiiSMS({
      to: phone,
      message:
        `Mebrek Farms: We have received your order ${bookingNumber}. ` +
        "Our team will contact you to confirm the details. Thank you.",
    });

    console.log(`Order confirmation SMS processed for ${bookingNumber}.`);
  } catch (error) {
    // An SMS failure must never undo an order that was already saved.
    console.error(
      `Order confirmation SMS failed for ${bookingNumber}:`,
      error.message,
    );
  }
}

// PUBLIC — accepts the existing website payload unchanged.
exports.createOrder = async (req, res) => {
  try {
    const { name, contact, message } = req.body || {};

    const cleanName = String(name || "").trim();
    const cleanContact = String(contact || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanName || !cleanContact || !cleanMessage) {
      return res.status(400).json({
        message: "Name, contact and message are required",
      });
    }

    // Reserve a permanent number for every new website order.
    const bookingNumber = await nextBookingNumber();

    const order = await Order.create({
      bookingNumber,
      name: cleanName,
      contact: cleanContact,
      message: cleanMessage,
      source: "Website",
      bookingAt: new Date(),
      status: "Pending",
      contactStatus: "Not Scheduled",
    });

    // Emit the saved document, including its booking number.
    emitOrder(req, "newOrder", order);

    // Send the confirmation SMS without waiting for delivery.
    void sendOrderConfirmationSMS(order);

    console.log(
      `New website order created: MF-${String(bookingNumber).padStart(5, "0")}`,
      order.name,
    );

    return res.status(201).json({
      message: "Order submitted successfully",
      bookingNumber: order.bookingNumber,
      order,
    });
  } catch (error) {
    console.error("CREATE WEBSITE ORDER ERROR:", error);

    return res.status(500).json({
      message: "Failed to submit order",
      error: error.message,
    });
  }
};

// PROTECTED — returns all orders for the admin register.
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customer", "name phone email address customerType isActive")
      .sort({ bookingAt: 1, createdAt: 1 });

    return res.json(orders);
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);

    return res
      .status(500)
      .json({ message: "Failed to fetch orders", error: error.message });
  }
};

// PROTECTED — admin-entered advance booking.
exports.createManualBooking = async (req, res) => {
  try {
    const body = req.body || {};
    let customer = null;

    if (body.customerId) {
      if (!mongoose.isValidObjectId(body.customerId)) {
        return res.status(400).json({
          message: "Invalid customer selection",
        });
      }

      customer = await Customer.findOne({
        _id: body.customerId,
        isDeleted: false,
        isActive: true,
      });

      if (!customer) {
        return res.status(404).json({
          message: "Active customer not found",
        });
      }
    }

    const { name, contact } = combineNameContact(body, customer);

    if (!name || !contact) {
      return res.status(400).json({
        message: "Customer name and phone number are required",
      });
    }

    const productType = ["Eggs", "Manure", "Other"].includes(body.productType)
      ? body.productType
      : null;

    if (!productType) {
      return res.status(400).json({
        message: "Select a valid product type",
      });
    }

    const quantity = Number(body.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than zero",
      });
    }

    const quantityUnit = String(body.quantityUnit || "").trim();

    if (!quantityUnit) {
      return res.status(400).json({
        message: "Quantity unit is required",
      });
    }

    const nextContactAt = body.nextContactAt
      ? new Date(body.nextContactAt)
      : null;

    const collectionAt = body.collectionAt ? new Date(body.collectionAt) : null;

    const bookingAt = body.bookingAt ? new Date(body.bookingAt) : new Date();

    for (const [label, date] of [
      ["Booking date", bookingAt],
      ["Next contact date", nextContactAt],
      ["Collection date", collectionAt],
    ]) {
      if (date && Number.isNaN(date.getTime())) {
        return res.status(400).json({
          message: `${label} is invalid`,
        });
      }
    }

    const bookingNumber = await nextBookingNumber();

    const order = await Order.create({
      bookingNumber,
      customer: customer?._id || null,
      name,
      contact,
      message: String(body.message || `${productType} advance booking`).trim(),
      productType,
      quantity,
      quantityUnit,
      bookingAt,
      nextContactAt,
      contactStatus: nextContactAt ? "Scheduled" : "Not Scheduled",
      collectionAt,
      bookingNotes: String(body.bookingNotes || "").trim(),
      source: "Manual",
      status: "Pending",
      createdBy: {
        id: getAdminId(req),
        name: String(getAdmin(req).name || getAdmin(req).adminName || ""),
      },
    });

    await order.populate(
      "customer",
      "name phone email address customerType isActive",
    );

    emitOrder(req, "newOrder", order);
    emitOrder(req, "orderBookingCreated", order);

    // Send the confirmation SMS without waiting for delivery.
    void sendOrderConfirmationSMS(order);

    return res.status(201).json({
      message: "Advance booking created successfully",
      order,
    });
  } catch (error) {
    console.error("CREATE MANUAL BOOKING ERROR:", error);

    return res.status(500).json({
      message: "Failed to create advance booking",
      error: error.message,
    });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${ORDER_STATUSES.join(", ")}`,
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    order.status = status;

    if (status === "Contacted" && order.contactStatus !== "Completed") {
      order.contactStatus = "Contacted";
    }

    await order.save();

    emitOrder(req, "orderStatusUpdated", order);

    return res.json(order);
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};

// Update contact schedule/status and collection schedule.
exports.updateBookingDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const body = req.body || {};

    if (body.nextContactAt !== undefined) {
      if (body.nextContactAt === "" || body.nextContactAt === null) {
        order.nextContactAt = null;
        order.contactStatus = "Not Scheduled";
      } else {
        const date = new Date(body.nextContactAt);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            message: "Invalid contact date/time",
          });
        }

        order.nextContactAt = date;

        if (order.contactStatus === "Not Scheduled") {
          order.contactStatus = "Scheduled";
        }
      }
    }

    if (body.collectionAt !== undefined) {
      if (!body.collectionAt) {
        order.collectionAt = null;
      } else {
        const date = new Date(body.collectionAt);

        if (Number.isNaN(date.getTime())) {
          return res.status(400).json({
            message: "Invalid collection date/time",
          });
        }

        order.collectionAt = date;
      }
    }

    if (body.contactStatus !== undefined) {
      if (!CONTACT_STATUSES.includes(body.contactStatus)) {
        return res.status(400).json({
          message: `Contact status must be one of: ${CONTACT_STATUSES.join(", ")}`,
        });
      }

      order.contactStatus = body.contactStatus;
    }

    if (body.bookingNotes !== undefined) {
      order.bookingNotes = String(body.bookingNotes || "").trim();
    }

    await order.save();

    await order.populate(
      "customer",
      "name phone email address customerType isActive",
    );

    emitOrder(req, "orderBookingUpdated", order);

    return res.json(order);
  } catch (error) {
    console.error("UPDATE BOOKING DETAILS ERROR:", error);

    return res.status(500).json({
      message: "Failed to update booking",
      error: error.message,
    });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    emitOrder(req, "orderDeleted", {
      id: req.params.id,
    });

    return res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);

    return res.status(500).json({
      error: error.message,
    });
  }
};
