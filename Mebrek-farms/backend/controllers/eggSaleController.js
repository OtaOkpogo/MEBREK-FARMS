const EggSale = require("../models/EggSale");

// =========================
// GET ALL SALES
// =========================

exports.getSales = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    let filter = {};

    if (!isSuperadmin) {
      // Non-superadmin roles only see active sales entered in the
      // last 24 hours. Deleted records are never visible to them.
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filter = { isDeleted: false, createdAt: { $gte: cutoff } };
    }
    // Superadmin: no filter at all — sees every sale, active or
    // deleted, regardless of age.

    const sales = await EggSale.find(filter)
      .sort({ createdAt: -1 })
      .populate("deletedBy", "role name");

    res.json(sales);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// GET SINGLE SALE
// =========================

exports.getSale = async (req, res) => {
  try {
    const sale = await EggSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    res.json(sale);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// INVOICE NUMBER GENERATION
// =========================
// Derives the next invoice number from the highest one actually issued
// this year, instead of a document count (which drops whenever a sale
// is deleted and causes collisions). Invoice numbers are zero-padded
// to a fixed width, so string sort order matches numeric order.

const generateInvoiceNumber = async (year) => {
  const prefix = `INV-${year}-`;

  const lastSale = await EggSale.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  let nextSeq = 1;

  if (lastSale?.invoiceNumber) {
    const lastSeq = parseInt(lastSale.invoiceNumber.replace(prefix, ""), 10);

    if (!Number.isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
};

// =========================
// CREATE SALE
// =========================

exports.createSale = async (req, res) => {
  try {
    const {
      customer,
      phone,
      date,
      cratesSold,
      looseEggs,
      cratePrice,
      eggPrice,
      discount,
      transportCharge,
      amountPaid,
      paymentMethod,
      remarks,
    } = req.body;

    const cratesTotal = Number(cratesSold || 0) * Number(cratePrice || 0);

    const looseEggTotal = Number(looseEggs || 0) * Number(eggPrice || 0);

    const totalAmount =
      cratesTotal +
      looseEggTotal +
      Number(transportCharge || 0) -
      Number(discount || 0);

    const balance = totalAmount - Number(amountPaid || 0);

    let status = "Unpaid";

    if (balance <= 0) status = "Paid";
    else if (amountPaid > 0) status = "Part Paid";

    const year = new Date().getFullYear();

    // Retry loop: if two requests race and both grab the same invoice
    // number, the unique index rejects the second insert (E11000).
    // Regenerate and try again rather than failing the request.
    let sale;
    let attempts = 0;
    const maxAttempts = 5;

    while (!sale) {
      attempts += 1;

      const invoiceNumber = await generateInvoiceNumber(year);

      try {
        sale = await EggSale.create({
          invoiceNumber,
          customer,
          phone,
          date,
          cratesSold,
          looseEggs,
          cratePrice,
          eggPrice,
          discount,
          transportCharge,
          totalAmount,
          amountPaid,
          balance,
          paymentMethod,
          status,
          remarks,
          soldBy: req.user?.id,
        });
      } catch (err) {
        if (err.code === 11000 && attempts < maxAttempts) {
          // Someone else took this invoice number first — retry.
          continue;
        }
        throw err;
      }
    }

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// UPDATE SALE
// =========================

exports.updateSale = async (req, res) => {
  try {
    const sale = await EggSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    Object.assign(sale, req.body);

    const cratesTotal = sale.cratesSold * sale.cratePrice;

    const looseEggTotal = sale.looseEggs * sale.eggPrice;

    sale.totalAmount =
      cratesTotal + looseEggTotal + sale.transportCharge - sale.discount;

    sale.balance = sale.totalAmount - sale.amountPaid;

    if (sale.balance <= 0) sale.status = "Paid";
    else if (sale.amountPaid > 0) sale.status = "Part Paid";
    else sale.status = "Unpaid";

    await sale.save();

    res.json(sale);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// DELETE SALE (soft delete)
// =========================

exports.deleteSale = async (req, res) => {
  try {
    const sale = await EggSale.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user?.id;

    await sale.save();

    res.json({
      message: "Sale deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// GET DELETED SALES (superadmin only — gated in route)
// =========================

exports.getDeletedSales = async (req, res) => {
  try {
    const sales = await EggSale.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("deletedBy", "role name");

    res.json(sales);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// RESTORE SALE (superadmin only — gated in route)
// =========================

exports.restoreSale = async (req, res) => {
  try {
    const sale = await EggSale.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!sale) {
      return res.status(404).json({
        message: "Deleted sale not found",
      });
    }

    sale.isDeleted = false;
    sale.deletedAt = null;
    sale.deletedBy = null;

    await sale.save();

    res.json(sale);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
