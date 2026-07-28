const ManureSale = require("../models/ManureSale");
const { MANURE_CATEGORY_PRICES } = require("../models/ManureSale");

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

    const sales = await ManureSale.find(filter)
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
    const sale = await ManureSale.findById(req.params.id);

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
// Prefix is MNR- to keep manure invoices distinct from egg invoices
// (INV-) even though both live in the same "Invoice #" mental space
// for whoever is reconciling paperwork.

const generateInvoiceNumber = async (year) => {
  const prefix = `MNR-${year}-`;

  const lastSale = await ManureSale.findOne({
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
// LINE ITEM VALIDATION + CALCULATION
// =========================
// Never trusts prices sent from the frontend. Each line item's
// pricePerBag is forced to match MANURE_CATEGORY_PRICES for its
// category, so a tampered request body can't undercharge a customer.

const buildValidatedLineItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error("At least one line item (manure category) is required.");
  }

  return lineItems.map((item) => {
    const category = item.category;
    const officialPrice = MANURE_CATEGORY_PRICES[category];

    if (!officialPrice) {
      throw new Error(`Unknown manure category: ${category}`);
    }

    const bags = Number(item.bags || 0);
    const pricePerBag = officialPrice;
    const subtotal = bags * pricePerBag;

    return { category, bags, pricePerBag, subtotal };
  });
};

const calculateTotals = (validatedLineItems, transportCharge = 0, discount = 0) => {
  const itemsTotal = validatedLineItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalAmount = itemsTotal + Number(transportCharge || 0) - Number(discount || 0);
  return totalAmount;
};

const resolveStatus = (totalAmount, amountPaid) => {
  const balance = totalAmount - Number(amountPaid || 0);
  let status = "Unpaid";
  if (balance <= 0) status = "Paid";
  else if (amountPaid > 0) status = "Part Paid";
  return { balance, status };
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
      lineItems,
      discount,
      transportCharge,
      amountPaid,
      paymentMethod,
      remarks,
    } = req.body;

    const validatedLineItems = buildValidatedLineItems(lineItems);
    const totalAmount = calculateTotals(validatedLineItems, transportCharge, discount);
    const { balance, status } = resolveStatus(totalAmount, amountPaid);

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
        sale = await ManureSale.create({
          invoiceNumber,
          customer,
          phone,
          date,
          lineItems: validatedLineItems,
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
    res.status(400).json({
      message: err.message,
    });
  }
};

// =========================
// UPDATE SALE
// =========================

exports.updateSale = async (req, res) => {
  try {
    const sale = await ManureSale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    const {
      customer,
      phone,
      date,
      lineItems,
      discount,
      transportCharge,
      amountPaid,
      paymentMethod,
      remarks,
    } = req.body;

    // Only re-validate/recalculate line items if the caller actually
    // sent new ones; otherwise keep the sale's existing items.
    const validatedLineItems = lineItems
      ? buildValidatedLineItems(lineItems)
      : sale.lineItems;

    sale.customer = customer ?? sale.customer;
    sale.phone = phone ?? sale.phone;
    sale.date = date ?? sale.date;
    sale.lineItems = validatedLineItems;
    sale.discount = discount ?? sale.discount;
    sale.transportCharge = transportCharge ?? sale.transportCharge;
    sale.amountPaid = amountPaid ?? sale.amountPaid;
    sale.paymentMethod = paymentMethod ?? sale.paymentMethod;
    sale.remarks = remarks ?? sale.remarks;

    sale.totalAmount = calculateTotals(
      validatedLineItems,
      sale.transportCharge,
      sale.discount,
    );

    const { balance, status } = resolveStatus(sale.totalAmount, sale.amountPaid);
    sale.balance = balance;
    sale.status = status;

    // Legacy-record safety net (mirrors eggSaleController) — should
    // never actually trigger here since ManureSale always requires
    // lineItems from creation, but kept for consistency in case this
    // model's validation rules loosen in the future.
    const skipValidation = !lineItems && (!sale.lineItems || sale.lineItems.length === 0);
    await sale.save({ validateBeforeSave: !skipValidation });

    res.json(sale);
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
};

// =========================
// DELETE SALE (soft delete)
// =========================

exports.deleteSale = async (req, res) => {
  try {
    const sale = await ManureSale.findOne({
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

    await sale.save({ validateBeforeSave: false });

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
    const sales = await ManureSale.find({ isDeleted: true })
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
    const sale = await ManureSale.findOne({
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

    await sale.save({ validateBeforeSave: false });

    res.json(sale);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
