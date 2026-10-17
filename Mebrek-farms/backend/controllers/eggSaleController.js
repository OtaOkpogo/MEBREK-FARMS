const EggSale = require("../models/EggSale");
const Customer = require("../models/Customer");
const { EGG_CATEGORY_PRICES } = require("../models/EggSale");
const SaleAccessRequest = require("../models/SaleAccessRequest");

const ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

const getRequesterId = (req) => req.user?.id || req.user?._id || null;

const isWithinRecentWindow = (sale) =>
  !!sale?.createdAt &&
  new Date(sale.createdAt).getTime() >= Date.now() - ACCESS_WINDOW_MS;

async function hasTemporarySaleAccess(req, saleType, sale) {
  if (req.user?.role === "superadmin") return true;

  const requesterId = getRequesterId(req);

  if (!requesterId || !sale || sale.isDeleted) return false;

  if (isWithinRecentWindow(sale)) return true;

  return !!(await SaleAccessRequest.exists({
    saleType,
    saleId: sale._id,
    requesterId,
    status: "approved",
    accessExpiresAt: { $gt: new Date() },
  }));
}

async function getGrantedSaleIds(req, saleType) {
  if (req.user?.role === "superadmin") return null;

  const requesterId = getRequesterId(req);

  if (!requesterId) return [];

  const rows = await SaleAccessRequest.find({
    saleType,
    requesterId,
    status: "approved",
    accessExpiresAt: { $gt: new Date() },
  })
    .select("saleId")
    .lean();

  return rows.map((row) => row.saleId);
}

// =====================================================
// CONSTANTS
// =====================================================

const EGGS_PER_CRATE = 30;
const VALID_PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

// =====================================================
// EGG CATEGORY VALIDATION
// =====================================================

const buildValidatedLineItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error("At least one egg category is required.");
  }

  const seenCategories = new Set();

  return lineItems.map((item) => {
    const category = String(item?.category || "")
      .trim()
      .toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(EGG_CATEGORY_PRICES, category)) {
      throw new Error(`Unknown egg category: ${category}`);
    }

    if (seenCategories.has(category)) {
      throw new Error(
        `The ${category} egg category has been entered more than once.`,
      );
    }

    seenCategories.add(category);

    const cratesSold = Number(item?.cratesSold || 0);
    const halfCratesSold = Number(item?.halfCratesSold || 0);
    const looseEggs = Number(item?.looseEggs || 0);

    if (
      !Number.isFinite(cratesSold) ||
      !Number.isFinite(halfCratesSold) ||
      !Number.isFinite(looseEggs)
    ) {
      throw new Error("Egg quantities must be valid numbers.");
    }

    if (cratesSold < 0 || halfCratesSold < 0 || looseEggs < 0) {
      throw new Error("Egg quantities cannot be negative.");
    }

    const cratePrice = Number(EGG_CATEGORY_PRICES[category]);
    const halfCratePrice = cratePrice / 2;
    const eggPrice = Math.round(cratePrice / EGGS_PER_CRATE);

    const subtotal =
      cratesSold * cratePrice +
      halfCratesSold * halfCratePrice +
      looseEggs * eggPrice;

    return {
      category,
      cratesSold,
      halfCratesSold,
      looseEggs,
      cratePrice,
      eggPrice,
      subtotal,
    };
  });
};

// =====================================================
// LEGACY SALE CALCULATION
// =====================================================

const getLegacySaleTotal = (sale) => {
  const cratePrice = Number(sale.cratePrice || 0);

  const cratesTotal = Number(sale.cratesSold || 0) * cratePrice;
  const halfCratesTotal = Number(sale.halfCratesSold || 0) * (cratePrice / 2);
  const looseEggTotal =
    Number(sale.looseEggs || 0) * Number(sale.eggPrice || 0);

  return cratesTotal + halfCratesTotal + looseEggTotal;
};

// =====================================================
// CALCULATE SALE TOTAL
// =====================================================

const calculateTotal = (lineItems, transportCharge = 0, discount = 0) => {
  const itemsTotal = lineItems.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0,
  );

  const transport = Number(transportCharge || 0);
  const discountAmount = Number(discount || 0);

  if (!Number.isFinite(transport)) {
    throw new Error("Invalid transport charge.");
  }

  if (!Number.isFinite(discountAmount)) {
    throw new Error("Invalid discount amount.");
  }

  return Math.max(0, itemsTotal + transport - discountAmount);
};

// =====================================================
// NORMALIZE PAYMENT SEGMENTS
// =====================================================

const normalizePayments = (payments) => {
  if (!Array.isArray(payments)) return [];

  return payments
    .map((payment) => {
      if (!payment) return null;

      const method = String(payment.method || "").trim();
      const amount = Number(payment.amount || 0);

      if (!method && amount <= 0) return null;

      if (!VALID_PAYMENT_METHODS.includes(method)) {
        throw new Error(
          "Invalid payment method. Allowed methods are Cash, Transfer and POS.",
        );
      }

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Payment amounts must be valid non-negative numbers.");
      }

      if (amount === 0) return null;

      let paidAt = new Date();

      if (payment.paidAt) {
        const suppliedDate = new Date(payment.paidAt);

        if (!Number.isNaN(suppliedDate.getTime())) {
          paidAt = suppliedDate;
        }
      }

      return { method, amount, paidAt };
    })
    .filter(Boolean);
};

// =====================================================
// PAYMENT CALCULATION
// =====================================================

const calculatePayment = (totalAmount, payments = []) => {
  const normalizedPayments = Array.isArray(payments) ? payments : [];

  const paid = normalizedPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  if (!Number.isFinite(paid)) {
    throw new Error("Invalid payment total.");
  }

  if (paid > totalAmount) {
    throw new Error(
      `Payment total of ₦${paid.toLocaleString()} cannot exceed the sale total of ₦${totalAmount.toLocaleString()}.`,
    );
  }

  const balance = Math.max(0, totalAmount - paid);

  let status = "Unpaid";

  if (totalAmount === 0) {
    status = "Unpaid";
  } else if (paid >= totalAmount) {
    status = "Paid";
  } else if (paid > 0) {
    status = "Part Paid";
  }

  const methods = [
    ...new Set(normalizedPayments.map((payment) => payment.method)),
  ];

  let paymentMethod = "Cash";

  if (methods.length === 1) {
    paymentMethod = methods[0];
  } else if (methods.length > 1) {
    paymentMethod = "Mixed";
  }

  return {
    amountPaid: paid,
    balance,
    status,
    paymentMethod,
  };
};

// =====================================================
// RESOLVE PAYMENTS
// =====================================================

const resolvePayments = ({ payments, amountPaid, paymentMethod }) => {
  if (Array.isArray(payments)) {
    return normalizePayments(payments);
  }

  const legacyAmount = Number(amountPaid || 0);

  if (!Number.isFinite(legacyAmount) || legacyAmount < 0) {
    throw new Error("Invalid amount paid.");
  }

  if (legacyAmount === 0) return [];

  const legacyMethod = String(paymentMethod || "Cash").trim();

  if (!VALID_PAYMENT_METHODS.includes(legacyMethod)) {
    throw new Error(
      "Invalid payment method. Allowed methods are Cash, Transfer and POS.",
    );
  }

  return [
    {
      method: legacyMethod,
      amount: legacyAmount,
      paidAt: new Date(),
    },
  ];
};

// =====================================================
// INVOICE NUMBER
// =====================================================

const generateInvoiceNumber = async (year) => {
  const prefix = `INV-${year}-`;

  const lastSale = await EggSale.findOne({
    invoiceNumber: {
      $regex: `^${prefix}`,
    },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  let nextSequence = 1;

  if (lastSale?.invoiceNumber) {
    const lastSequence = parseInt(
      lastSale.invoiceNumber.replace(prefix, ""),
      10,
    );

    if (!Number.isNaN(lastSequence)) {
      nextSequence = lastSequence + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
};

// =====================================================
// RESOLVE CUSTOMER
// =====================================================

const resolveCustomer = async ({ customerId, customer, phone }) => {
  if (!customerId) {
    const customerName = String(customer || "").trim();

    if (!customerName) {
      throw new Error("Customer name is required.");
    }

    return {
      customerId: null,
      customer: customerName,
      phone: String(phone || "").trim(),
    };
  }

  let customerRecord;

  try {
    customerRecord = await Customer.findOne({
      _id: customerId,
      isDeleted: false,
      isActive: true,
    });
  } catch (err) {
    if (err.name === "CastError") {
      throw new Error("Invalid customer selected.");
    }

    throw err;
  }

  if (!customerRecord) {
    throw new Error("Selected customer was not found or is inactive.");
  }

  return {
    customerId: customerRecord._id,
    customer: customerRecord.name,
    phone: customerRecord.phone || "",
  };
};

// =====================================================
// OUTSTANDING CUSTOMER SUMMARY
// Older unpaid sales remain included here.
// =====================================================

exports.getOutstandingCustomers = async (req, res) => {
  try {
    const role = req.user?.role;

    if (!["superadmin", "manager"].includes(role)) {
      return res.status(403).json({
        message: "You are not authorized to view outstanding egg balances.",
      });
    }

    const sales = await EggSale.find({ isDeleted: false })
      .select(
        "customerId customer phone date createdAt totalAmount amountPaid balance",
      )
      .populate("customerId", "name phone")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    const grouped = new Map();

    for (const sale of sales) {
      const total = Number(sale.totalAmount || 0);
      const paid = Number(sale.amountPaid || 0);
      const balance = Math.max(0, total - paid);

      if (balance <= 0) continue;

      const customer =
        sale.customerId && typeof sale.customerId === "object"
          ? sale.customerId
          : null;

      const name = String(
        sale.customer || customer?.name || "Unknown customer",
      ).trim();

      const phone = String(sale.phone || customer?.phone || "").trim();

      const customerId = customer?._id
        ? String(customer._id)
        : sale.customerId
          ? String(sale.customerId)
          : "";

      const normalizedPhone = phone.replace(/\D/g, "");

      const key = customerId
        ? `id:${customerId}`
        : normalizedPhone
          ? `phone:${normalizedPhone}`
          : `name:${name.toLowerCase()}`;

      const existing = grouped.get(key) || {
        key,
        customerId: customerId || null,
        name,
        phone,
        outstanding: 0,
        invoiceCount: 0,
        lastSale: sale.date || sale.createdAt || null,
      };

      existing.outstanding += balance;
      existing.invoiceCount += 1;

      if (!existing.phone && phone) existing.phone = phone;

      if ((!existing.name || existing.name === "Unknown customer") && name) {
        existing.name = name;
      }

      const currentDate = new Date(sale.date || sale.createdAt || 0).getTime();

      const previousDate = new Date(existing.lastSale || 0).getTime();

      if (currentDate > previousDate) {
        existing.lastSale = sale.date || sale.createdAt;
      }

      grouped.set(key, existing);
    }

    const customers = Array.from(grouped.values()).sort(
      (a, b) => b.outstanding - a.outstanding,
    );

    return res.json({
      customers,
      totalCustomers: customers.length,
      totalOutstanding: customers.reduce(
        (sum, customer) => sum + customer.outstanding,
        0,
      ),
    });
  } catch (err) {
    console.error("GET OUTSTANDING EGG CUSTOMERS ERROR:", err);

    return res.status(500).json({
      message: err.message || "Unable to load outstanding balances.",
    });
  }
};

// =====================================================
// GET ALL SALES
// Managers: non-deleted sales dated within the last 24 hours.
// Superadmins: full sales history.
// =====================================================

exports.getSales = async (req, res) => {
  try {
    const role = req.user?.role;

    let filter = {};

    if (role === "superadmin") {
      // Superadmin can view the full sales history.
      filter = {};
    } else if (role === "manager") {
      const now = new Date();
      const cutoff = new Date(now.getTime() - ACCESS_WINDOW_MS);

      filter = {
        isDeleted: false,
        date: {
          $gte: cutoff,
          $lte: now,
        },
      };
    } else {
      return res.status(403).json({
        message: "You are not authorized to view egg sales.",
      });
    }

    const sales = await EggSale.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .populate("customerId", "name phone email address customerType isActive")
      .populate("deletedBy", "role name")
      .populate("soldBy", "role name");

    return res.json(sales);
  } catch (err) {
    console.error("GET SALES ERROR:", err);

    return res.status(500).json({
      message: err.message || "Unable to load egg sales.",
    });
  }
};

// =====================================================
// GET SINGLE SALE
// =====================================================

exports.getSale = async (req, res) => {
  try {
    const sale = await EggSale.findById(req.params.id)
      .populate("customerId", "name phone email address customerType isActive")
      .populate("deletedBy", "role name")
      .populate("soldBy", "role name");

    if (!sale || (req.user?.role !== "superadmin" && sale.isDeleted)) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (!(await hasTemporarySaleAccess(req, "egg", sale))) {
      return res.status(403).json({
        message:
          "This sale is older than 24 hours. Request temporary access from a superadmin.",
      });
    }

    return res.json(sale);
  } catch (err) {
    console.error("GET SINGLE SALE ERROR:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

// =====================================================
// CREATE SALE
// =====================================================

exports.createSale = async (req, res) => {
  try {
    const {
      customerId,
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

    const resolvedCustomer = await resolveCustomer({
      customerId,
      customer,
      phone,
    });

    const saleDate = date ? new Date(`${date}T12:00:00`) : new Date();

    if (Number.isNaN(saleDate.getTime())) {
      return res.status(400).json({
        message: "Invalid sale date.",
      });
    }

    const validatedLineItems = buildValidatedLineItems(lineItems);

    const totalAmount = calculateTotal(
      validatedLineItems,
      transportCharge,
      discount,
    );

    const resolvedPayments = resolvePayments({
      payments,
      amountPaid,
      paymentMethod,
    });

    const paymentSummary = calculatePayment(totalAmount, resolvedPayments);

    const year = saleDate.getFullYear();

    let sale = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (!sale && attempts < maxAttempts) {
      attempts++;

      const invoiceNumber = await generateInvoiceNumber(year);

      try {
        sale = await EggSale.create({
          invoiceNumber,
          customerId: resolvedCustomer.customerId,
          customer: resolvedCustomer.customer,
          phone: resolvedCustomer.phone,
          date: saleDate,
          lineItems: validatedLineItems,
          discount: Math.max(0, Number(discount || 0)),
          transportCharge: Math.max(0, Number(transportCharge || 0)),
          totalAmount,
          payments: resolvedPayments,
          amountPaid: paymentSummary.amountPaid,
          balance: paymentSummary.balance,
          paymentMethod: paymentSummary.paymentMethod,
          status: paymentSummary.status,
          remarks: String(remarks || "").trim(),
          soldBy: req.user?.id || null,
        });
      } catch (err) {
        if (err.code === 11000 && attempts < maxAttempts) {
          continue;
        }

        throw err;
      }
    }

    if (!sale) {
      throw new Error("Unable to generate a unique invoice number.");
    }

    await sale.populate(
      "customerId",
      "name phone email address customerType isActive",
    );

    await sale.populate("soldBy", "role name");

    return res.status(201).json(sale);
  } catch (err) {
    console.error("CREATE SALE ERROR:", err);

    return res.status(400).json({
      message: err.message,
    });
  }
};

// =====================================================
// UPDATE SALE
// =====================================================

exports.updateSale = async (req, res) => {
  try {
    const sale = await EggSale.findById(req.params.id);

    if (!sale || (req.user?.role !== "superadmin" && sale.isDeleted)) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (!(await hasTemporarySaleAccess(req, "egg", sale))) {
      return res.status(403).json({
        message:
          "This sale is older than 24 hours. Request temporary access from a superadmin.",
      });
    }

    const {
      customerId,
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

    // CUSTOMER
    if (customerId !== undefined) {
      if (customerId === null || customerId === "") {
        const manualName = String(customer || "").trim();

        if (!manualName) {
          return res.status(400).json({
            message: "Customer name is required.",
          });
        }

        sale.customerId = null;
        sale.customer = manualName;
        sale.phone = String(phone || "").trim();
      } else {
        const resolvedCustomer = await resolveCustomer({
          customerId,
          customer,
          phone,
        });

        sale.customerId = resolvedCustomer.customerId;
        sale.customer = resolvedCustomer.customer;
        sale.phone = resolvedCustomer.phone;
      }
    } else {
      if (customer !== undefined) {
        const manualName = String(customer || "").trim();

        if (!manualName) {
          return res.status(400).json({
            message: "Customer name is required.",
          });
        }

        sale.customer = manualName;
      }

      if (phone !== undefined) {
        sale.phone = String(phone || "").trim();
      }
    }

    // DATE
    if (date !== undefined) {
      const newDate = new Date(`${date}T12:00:00`);

      if (Number.isNaN(newDate.getTime())) {
        return res.status(400).json({
          message: "Invalid sale date.",
        });
      }

      sale.date = newDate;
    }

    // LINE ITEMS
    if (lineItems !== undefined) {
      sale.lineItems = buildValidatedLineItems(lineItems);
    }

    // DISCOUNT
    if (discount !== undefined) {
      const value = Number(discount || 0);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          message: "Invalid discount amount.",
        });
      }

      sale.discount = Math.max(0, value);
    }

    // TRANSPORT
    if (transportCharge !== undefined) {
      const value = Number(transportCharge || 0);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          message: "Invalid transport charge.",
        });
      }

      sale.transportCharge = Math.max(0, value);
    }

    // RECALCULATE TOTAL
    let itemsTotal = 0;

    if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
      itemsTotal = sale.lineItems.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );
    } else {
      itemsTotal = getLegacySaleTotal(sale);
    }

    sale.totalAmount = Math.max(
      0,
      itemsTotal +
        Number(sale.transportCharge || 0) -
        Number(sale.discount || 0),
    );

    // PAYMENT UPDATE
    if (Array.isArray(payments)) {
      const resolvedPayments = resolvePayments({
        payments,
        amountPaid,
        paymentMethod,
      });

      const paymentSummary = calculatePayment(
        sale.totalAmount,
        resolvedPayments,
      );

      sale.payments = resolvedPayments;
      sale.amountPaid = paymentSummary.amountPaid;
      sale.balance = paymentSummary.balance;
      sale.paymentMethod = paymentSummary.paymentMethod;
      sale.status = paymentSummary.status;
    } else if (amountPaid !== undefined || paymentMethod !== undefined) {
      let updatedAmountPaid = Number(sale.amountPaid || 0);

      if (amountPaid !== undefined) {
        const value = Number(amountPaid || 0);

        if (!Number.isFinite(value) || value < 0) {
          return res.status(400).json({
            message: "Invalid amount paid.",
          });
        }

        updatedAmountPaid = value;
      }

      let updatedPaymentMethod = VALID_PAYMENT_METHODS.includes(
        sale.paymentMethod,
      )
        ? sale.paymentMethod
        : "Cash";

      if (paymentMethod !== undefined) {
        updatedPaymentMethod = String(paymentMethod).trim();

        if (!VALID_PAYMENT_METHODS.includes(updatedPaymentMethod)) {
          return res.status(400).json({
            message:
              "Invalid payment method. Allowed methods are Cash, Transfer and POS.",
          });
        }
      }

      const legacyPayments =
        updatedAmountPaid > 0
          ? [
              {
                method: updatedPaymentMethod,
                amount: updatedAmountPaid,
                paidAt: new Date(),
              },
            ]
          : [];

      const paymentSummary = calculatePayment(sale.totalAmount, legacyPayments);

      sale.payments = legacyPayments;
      sale.amountPaid = paymentSummary.amountPaid;
      sale.balance = paymentSummary.balance;
      sale.paymentMethod = paymentSummary.paymentMethod;
      sale.status = paymentSummary.status;
    } else {
      let existingPayments = [];

      if (Array.isArray(sale.payments) && sale.payments.length > 0) {
        existingPayments = normalizePayments(sale.payments);
      } else if (Number(sale.amountPaid || 0) > 0) {
        const legacyMethod = VALID_PAYMENT_METHODS.includes(sale.paymentMethod)
          ? sale.paymentMethod
          : "Cash";

        existingPayments = [
          {
            method: legacyMethod,
            amount: Number(sale.amountPaid || 0),
            paidAt: sale.updatedAt || new Date(),
          },
        ];
      }

      const paymentSummary = calculatePayment(
        sale.totalAmount,
        existingPayments,
      );

      sale.payments = existingPayments;
      sale.amountPaid = paymentSummary.amountPaid;
      sale.balance = paymentSummary.balance;
      sale.paymentMethod = paymentSummary.paymentMethod;
      sale.status = paymentSummary.status;
    }

    // REMARKS
    if (remarks !== undefined) {
      sale.remarks = String(remarks || "").trim();
    }

    await sale.save({
      validateBeforeSave: false,
    });

    await sale.populate(
      "customerId",
      "name phone email address customerType isActive",
    );

    await sale.populate("soldBy", "role name");

    return res.json(sale);
  } catch (err) {
    console.error("UPDATE SALE ERROR:", err);

    return res.status(400).json({
      message: err.message,
    });
  }
};

// =====================================================
// DELETE SALE
// =====================================================

exports.deleteSale = async (req, res) => {
  try {
    const sale = await EggSale.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (req.user?.role !== "superadmin" && !isWithinRecentWindow(sale)) {
      return res.status(403).json({
        message:
          "Temporary access does not grant permission to delete older sales.",
      });
    }

    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user?.id || null;

    await sale.save({
      validateBeforeSave: false,
    });

    return res.json({
      message: "Sale deleted successfully",
    });
  } catch (err) {
    console.error("DELETE SALE ERROR:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

// =====================================================
// GET DELETED SALES
// =====================================================

exports.getDeletedSales = async (req, res) => {
  try {
    const sales = await EggSale.find({
      isDeleted: true,
    })
      .sort({ deletedAt: -1 })
      .populate("customerId", "name phone email address customerType")
      .populate("deletedBy", "role name")
      .populate("soldBy", "role name");

    return res.json(sales);
  } catch (err) {
    console.error("GET DELETED SALES ERROR:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

// =====================================================
// RESTORE SALE
// =====================================================

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

    await sale.save({
      validateBeforeSave: false,
    });

    await sale.populate(
      "customerId",
      "name phone email address customerType isActive",
    );

    await sale.populate("soldBy", "role name");

    return res.json(sale);
  } catch (err) {
    console.error("RESTORE SALE ERROR:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

// =====================================================
// GET SALES FOR CUSTOMER
// =====================================================

exports.getSalesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    let customer;

    try {
      customer = await Customer.findOne({
        _id: customerId,
        isDeleted: false,
      }).select("name phone email address customerType isActive");
    } catch (err) {
      if (err.name === "CastError") {
        return res.status(400).json({
          message: "Invalid customer ID.",
        });
      }

      throw err;
    }

    if (!customer) {
      return res.status(404).json({
        message: "Customer not found.",
      });
    }

    const customerSaleFilter = {
      customerId,
      isDeleted: false,
    };

    if (req.user?.role !== "superadmin") {
      const cutoff = new Date(Date.now() - ACCESS_WINDOW_MS);
      const grantedIds = await getGrantedSaleIds(req, "egg");

      customerSaleFilter.$or = [
        { createdAt: { $gte: cutoff } },
        { _id: { $in: grantedIds } },
      ];
    }

    const sales = await EggSale.find(customerSaleFilter)
      .sort({ date: -1, createdAt: -1 })
      .select(
        "invoiceNumber customer phone date lineItems totalAmount amountPaid balance status paymentMethod payments",
      );

    const totalPurchases = sales.reduce(
      (sum, sale) => sum + Number(sale.totalAmount || 0),
      0,
    );

    const totalPaid = sales.reduce(
      (sum, sale) => sum + Number(sale.amountPaid || 0),
      0,
    );

    const totalOutstanding = sales.reduce(
      (sum, sale) => sum + Number(sale.balance || 0),
      0,
    );

    const totalCrates = sales.reduce((sum, sale) => {
      const saleCrates = Array.isArray(sale.lineItems)
        ? sale.lineItems.reduce(
            (lineSum, item) => lineSum + Number(item.cratesSold || 0),
            0,
          )
        : 0;

      return sum + saleCrates;
    }, 0);

    return res.json({
      customer,
      sales,
      summary: {
        transactionCount: sales.length,
        totalPurchases,
        totalPaid,
        totalOutstanding,
        totalCrates,
      },
    });
  } catch (err) {
    console.error("GET CUSTOMER SALES ERROR:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};
