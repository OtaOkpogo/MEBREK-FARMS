const FeedInvoice = require("../models/FeedInvoice");


// CREATE INVOICE
exports.createInvoice = async (req, res) => {
  try {

    const {
      supplier,
      feedName,
      quantity,
      unitPrice,
      paymentStatus,
    } = req.body;

    const totalCost = quantity * unitPrice;

    const invoice = new FeedInvoice({
      supplier,
      feedName,
      quantity,
      unitPrice,
      totalCost,
      paymentStatus,
    });

    await invoice.save();

    res.json(invoice);

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });
  }
};


// GET ALL INVOICES
exports.getInvoices = async (req, res) => {
  try {

    const invoices = await FeedInvoice.find().sort({
      createdAt: -1,
    });

    res.json(invoices);

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });
  }
};


// DELETE INVOICE
exports.deleteInvoice = async (req, res) => {
  try {

    await FeedInvoice.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "Invoice deleted",
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });
  }
};
