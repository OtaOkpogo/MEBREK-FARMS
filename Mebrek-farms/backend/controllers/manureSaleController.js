const ManureSale = require("../models/ManureSale");
const { MANURE_CATEGORY_PRICES } = require("../models/ManureSale");

// =========================
// PAYMENT HELPERS
// =========================

const PAYMENT_KEYS = ["cash", "transfer", "pos"];

const toValidAmount = (value, label) => {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be a valid non-negative amount.`);
  }

  return amount;
};

const normalizePayments = (
  payments,
  amountPaid = 0,
  paymentMethod = "Cash",
) => {
  // New frontend: use the individual payment amounts.
  if (
    payments &&
    typeof payments === "object" &&
    !Array.isArray(payments) &&
    PAYMENT_KEYS.some((key) => payments[key] !== undefined)
  ) {
    return {
      cash: toValidAmount(payments.cash, "Cash payment"),
      transfer: toValidAmount(payments.transfer, "Transfer payment"),
      pos: toValidAmount(payments.pos, "POS payment"),
    };
  }

  // Old frontend / existing record: use its single payment method.
  const legacyAmount = toValidAmount(amountPaid, "Amount paid");
  const method = paymentMethod || "Cash";

  if (!["Cash", "Transfer", "POS", "Mixed"].includes(method)) {
    throw new Error("Invalid payment method.");
  }

  if (method === "Mixed" && legacyAmount > 0) {
    throw new Error(
      "A Mixed payment must include a cash, transfer, and/or POS breakdown.",
    );
  }

  return {
    cash: method === "Cash" ? legacyAmount : 0,
    transfer: method === "Transfer" ? legacyAmount : 0,
    pos: method === "POS" ? legacyAmount : 0,
  };
};

const getTotalPaid = (payments) =>
  PAYMENT_KEYS.reduce((total, key) => total + Number(payments[key] || 0), 0);

const getPaymentMethod = (payments) => {
  const methods = [];

  if (payments.cash > 0) methods.push("Cash");
  if (payments.transfer > 0) methods.push("Transfer");
  if (payments.pos > 0) methods.push("POS");

  if (methods.length > 1) return "Mixed";
  if (methods.length === 1) return methods[0];

  return "Cash";
};

const resolveStatus = (totalAmount, amountPaid) => {
  const balance = Math.max(0, totalAmount - amountPaid);

  let status = "Unpaid";

  if (balance === 0) {
    status = "Paid";
  } else if (amountPaid > 0) {
    status = "Part Paid";
  }

  return { balance, status };
};

// =========================
// GET ALL SALES
// =========================

exports.getSales = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    let filter = {};

    if (!isSuperadmin) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      filter = {
        isDeleted: false,
        createdAt: { $gte: cutoff },
      };
    }

    const sales = await ManureSale.find(filter)
      .sort({ createdAt: -1 })
      .populate("deletedBy", "role name");

    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: err.message });
  }
};

// =========================
// INVOICE NUMBER GENERATION
// =========================

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
// LINE ITEM VALIDATION
// =========================

const buildValidatedLineItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error("At least one line item (manure category) is required.");
  }

  return lineItems.map((item) => {
    const category = item.category;
    const officialPrice = MANURE_CATEGORY_PRICES[category];

    if (officialPrice === undefined) {
      throw new Error(`Unknown manure category: ${category}`);
    }

    const bags = Number(item.bags);

    if (!Number.isFinite(bags) || bags <= 0) {
      throw new Error(
        `The number of bags for ${category} must be greater than zero.`,
      );
    }

    const pricePerBag = officialPrice;
    const subtotal = bags * pricePerBag;

    return {
      category,
      bags,
      pricePerBag,
      subtotal,
    };
  });
};

// =========================
// TOTAL CALCULATION
// =========================

const calculateTotals = (
  validatedLineItems,
  transportCharge = 0,
  discount = 0,
) => {
  const itemsTotal = validatedLineItems.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );

  const transport = toValidAmount(transportCharge, "Transport charge");

  const discountAmount = toValidAmount(discount, "Discount");

  const totalAmount = itemsTotal + transport - discountAmount;

  if (totalAmount < 0) {
    throw new Error(
      "Discount cannot exceed the total of manure and transport charges.",
    );
  }

  return totalAmount;
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
      payments,
      remarks,
    } = req.body;

    if (!customer || !String(customer).trim()) {
      return res.status(400).json({
        message: "Customer name is required.",
      });
    }

    const validatedLineItems = buildValidatedLineItems(lineItems);

    const totalAmount = calculateTotals(
      validatedLineItems,
      transportCharge,
      discount,
    );

    const normalizedPayments = normalizePayments(
      payments,
      amountPaid,
      paymentMethod || "Cash",
    );

    const totalPaid = getTotalPaid(normalizedPayments);

    if (totalPaid > totalAmount) {
      return res.status(400).json({
        message: "Total payment cannot exceed the sale total.",
      });
    }

    const { balance, status } = resolveStatus(totalAmount, totalPaid);

    const resolvedPaymentMethod = getPaymentMethod(normalizedPayments);

    const year = new Date().getFullYear();

    let sale;
    let attempts = 0;
    const maxAttempts = 5;

    while (!sale) {
      attempts += 1;

      const invoiceNumber = await generateInvoiceNumber(year);

      try {
        sale = await ManureSale.create({
          invoiceNumber,
          customer: String(customer).trim(),
          phone: phone || "",
          date: date || Date.now(),
          lineItems: validatedLineItems,
          discount: Number(discount || 0),
          transportCharge: Number(transportCharge || 0),
          totalAmount,
          payments: normalizedPayments,
          amountPaid: totalPaid,
          balance,
          paymentMethod: resolvedPaymentMethod,
          status,
          remarks: remarks || "",
          soldBy: req.user?.id,
        });
      } catch (err) {
        if (err.code === 11000 && attempts < maxAttempts) {
          continue;
        }

        throw err;
      }
    }

    return res.status(201).json(sale);
  } catch (err) {
    return res.status(400).json({
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
      payments,
      remarks,
    } = req.body;

    const validatedLineItems =
      lineItems !== undefined
        ? buildValidatedLineItems(lineItems)
        : sale.lineItems;

    const nextDiscount =
      discount !== undefined
        ? toValidAmount(discount, "Discount")
        : Number(sale.discount || 0);

    const nextTransport =
      transportCharge !== undefined
        ? toValidAmount(transportCharge, "Transport charge")
        : Number(sale.transportCharge || 0);

    const nextTotalAmount = calculateTotals(
      validatedLineItems,
      nextTransport,
      nextDiscount,
    );

    let normalizedPayments;

    if (payments !== undefined) {
      normalizedPayments = normalizePayments(payments);
    } else if (amountPaid !== undefined || paymentMethod !== undefined) {
      // Preserve compatibility with the previous frontend.
      normalizedPayments = normalizePayments(
        undefined,
        amountPaid ?? sale.amountPaid,
        paymentMethod ?? sale.paymentMethod,
      );
    } else {
      const savedPayments = sale.payments?.toObject
        ? sale.payments.toObject()
        : sale.payments;

      const hasSavedBreakdown =
        savedPayments &&
        PAYMENT_KEYS.some((key) => Number(savedPayments[key] || 0) > 0);

      normalizedPayments = hasSavedBreakdown
        ? normalizePayments(savedPayments)
        : normalizePayments(undefined, sale.amountPaid, sale.paymentMethod);
    }

    const totalPaid = getTotalPaid(normalizedPayments);

    if (totalPaid > nextTotalAmount) {
      return res.status(400).json({
        message: "Total payment cannot exceed the sale total.",
      });
    }

    if (customer !== undefined && !String(customer).trim()) {
      return res.status(400).json({
        message: "Customer name is required.",
      });
    }

    sale.customer =
      customer !== undefined ? String(customer).trim() : sale.customer;

    sale.phone = phone ?? sale.phone;
    sale.date = date ?? sale.date;
    sale.lineItems = validatedLineItems;
    sale.discount = nextDiscount;
    sale.transportCharge = nextTransport;
    sale.totalAmount = nextTotalAmount;
    sale.payments = normalizedPayments;
    sale.amountPaid = totalPaid;
    sale.paymentMethod = getPaymentMethod(normalizedPayments);
    sale.remarks = remarks ?? sale.remarks;

    const { balance, status } = resolveStatus(sale.totalAmount, totalPaid);

    sale.balance = balance;
    sale.status = status;

    const skipValidation =
      lineItems === undefined &&
      (!sale.lineItems || sale.lineItems.length === 0);

    await sale.save({
      validateBeforeSave: !skipValidation,
    });

    return res.json(sale);
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

// =========================
// DELETE SALE (SOFT DELETE)
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

    return res.json({
      message: "Sale deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// GET DELETED SALES
// SUPERADMIN ONLY — GATED IN ROUTE
// =========================

exports.getDeletedSales = async (req, res) => {
  try {
    const sales = await ManureSale.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("deletedBy", "role name");

    return res.json(sales);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

// =========================
// RESTORE SALE
// SUPERADMIN ONLY — GATED IN ROUTE
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

    return res.json(sale);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};
