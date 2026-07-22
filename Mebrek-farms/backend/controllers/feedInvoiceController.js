const FeedInvoice = require("../models/FeedInvoice");
const { addStock, removeStock } = require("../utils/feedInventoryHelper");

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

    const qty = Number(quantity);
    const price = Number(unitPrice);
    const paid = Number(amountPaid || 0);

    const totalCost = qty * price;

    const balance = Math.max(0, totalCost - paid);

    const invoice = await FeedInvoice.create({
      invoiceNumber: generateInvoiceNumber(),

      supplier,
      feedName,

      quantity: qty,
      unit: unit || "bags",

      unitPrice: price,

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

      createdBy: req.user?.name || "System",
      createdByRole: req.user?.role || "System",
    });

    await addStock({
      feedName,
      quantity: qty,
      unit: unit || "bags",
      unitPrice: price,
      supplier,
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================================
// UPDATE INVOICE
// ======================================
exports.updateInvoice = async (req, res) => {
  try {
    const invoice = await FeedInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    if (invoice.isDeleted) {
      return res.status(400).json({
        error: "Deleted invoices cannot be edited.",
      });
    }

    // Remove the old stock first
    await removeStock({
      feedName: invoice.feedName,
      quantity: invoice.quantity,
    });

    // Update editable fields
    invoice.supplier = req.body.supplier;
    invoice.feedName = req.body.feedName;

    invoice.quantity = Number(req.body.quantity);
    invoice.unit = req.body.unit || "bags";

    invoice.unitPrice = Number(req.body.unitPrice);

    invoice.purchaseDate = req.body.purchaseDate;
    invoice.receivedDate = req.body.receivedDate;

    invoice.paymentStatus = req.body.paymentStatus;
    invoice.paymentMethod = req.body.paymentMethod;

    invoice.amountPaid = Number(req.body.amountPaid || 0);

    invoice.transportCost = Number(req.body.transportCost || 0);

    invoice.vehicleNumber = req.body.vehicleNumber;
    invoice.driverName = req.body.driverName;
    invoice.receivedBy = req.body.receivedBy;
    invoice.warehouseLocation = req.body.warehouseLocation;
    invoice.remarks = req.body.remarks;

    // Recalculate totals
    invoice.totalCost = invoice.quantity * invoice.unitPrice;

    invoice.balance = Math.max(0, invoice.totalCost - invoice.amountPaid);

    invoice.updatedBy = req.user?.name || "System";
    invoice.updatedByRole = req.user?.role || "System";

    // Add the new stock back
    await addStock({
      feedName: invoice.feedName,
      quantity: invoice.quantity,
      unit: invoice.unit,
      unitPrice: invoice.unitPrice,
      supplier: invoice.supplier,
    });

    await invoice.save();

    res.json(invoice);
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
    const filter = req.user.role === "superadmin" ? {} : { isDeleted: false };

    const invoices = await FeedInvoice.find(filter).sort({
      purchaseDate: -1,
      createdAt: -1,
    });

    res.json(invoices);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================================
// DELETE INVOICE (SOFT DELETE)
// ======================================
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await FeedInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    if (invoice.isDeleted) {
      return res.status(400).json({
        error: "Invoice already deleted",
      });
    }

    // Remove inventory
    await removeStock({
      feedName: invoice.feedName,
      quantity: invoice.quantity,
    });

    invoice.isDeleted = true;

    invoice.deletedAt = new Date();

    invoice.deletedBy = req.user?.name || "System";

    invoice.deletedByRole = req.user?.role || "System";

    await invoice.save();

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

// ======================================
// RESTORE INVOICE
// ======================================
exports.restoreInvoice = async (req, res) => {
  try {
    const invoice = await FeedInvoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: "Invoice not found",
      });
    }

    if (!invoice.isDeleted) {
      return res.status(400).json({
        error: "Invoice is not deleted",
      });
    }

    invoice.isDeleted = false;

    invoice.deletedAt = null;
    invoice.deletedBy = null;
    invoice.deletedByRole = null;

    invoice.restoredAt = new Date();

    invoice.restoredBy = req.user?.name || "System";

    invoice.restoredByRole = req.user?.role || "System";

    await addStock({
      feedName: invoice.feedName,
      quantity: invoice.quantity,
      unit: invoice.unit,
      unitPrice: invoice.unitPrice,
      supplier: invoice.supplier,
    });

    await invoice.save();

    res.json({
      message: "Invoice restored successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ======================================
// GET DELETED INVOICES
// ======================================
exports.getDeletedInvoices = async (req, res) => {
  try {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const invoices = await FeedInvoice.find({
      isDeleted: true,
    }).sort({
      deletedAt: -1,
    });

    res.json(invoices);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};
