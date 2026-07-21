const FeedInvoice = require("../models/FeedInvoice");
const Feed = require("../models/Feed");

// ======================================
// Generate Invoice Number
// ======================================
const generateInvoiceNumber = () => {
  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `INV-${date}-${random}`;
};

// ======================================
// CREATE INVOICE
// ======================================
exports.createInvoice = async (req, res) => {
  try {
    const {
      supplier,
      feedName,
      quantity,
      unit,
      unitPrice,
      purchaseDate,
      receivedDate,
      paymentStatus,
      paymentMethod,
      amountPaid,
      transportCost,
      vehicleNumber,
      driverName,
      receivedBy,
      warehouseLocation,
      remarks,
    } = req.body;

    const totalCost = Number(quantity) * Number(unitPrice);
    const paid = Number(amountPaid || 0);
    const balance = totalCost - paid;

    const invoice = await FeedInvoice.create({
      invoiceNumber: generateInvoiceNumber(),

      supplier,

      feedName,

      quantity: Number(quantity),

      unit,

      unitPrice: Number(unitPrice),

      totalCost,

      purchaseDate,

      receivedDate,

      paymentStatus,

      paymentMethod,

      amountPaid: paid,

      balance,

      transportCost: Number(transportCost || 0),

      vehicleNumber,

      driverName,

      receivedBy,

      warehouseLocation,

      remarks,
    });

    // =============================
    // Update Feed Inventory
    // =============================

    let feed = await Feed.findOne({
      name: feedName,
      isDeleted: false,
    });

    if (feed) {
      feed.quantity += Number(quantity);

      feed.pricePerUnit = Number(unitPrice);

      feed.unit = unit || "bags";

      feed.supplier = supplier;

      await feed.save();
    } else {
      await Feed.create({
        name: feedName,

        quantity: Number(quantity),

        unit: unit || "bags",

        pricePerUnit: Number(unitPrice),

        supplier,
      });
    }

    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================================
// GET ALL INVOICES
// ======================================

exports.getInvoices = async (req, res) => {
  try {
    const invoices = await FeedInvoice.find().sort({
      purchaseDate: -1,
    });

    res.json(invoices);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================================
// DELETE INVOICE
// ======================================

exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await FeedInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    // Roll back inventory

    const feed = await Feed.findOne({
      name: invoice.feedName,
      isDeleted: false,
    });

    if (feed) {
      feed.quantity = Math.max(0, feed.quantity - invoice.quantity);

      await feed.save();
    }

    await invoice.deleteOne();

    res.json({
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};
