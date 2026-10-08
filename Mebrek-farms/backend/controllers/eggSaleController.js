const EggSale = require("../models/EggSale");
const Customer = require("../models/Customer");
const { EGG_CATEGORY_PRICES } = require("../models/EggSale");

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
    const looseEggs = Number(item?.looseEggs || 0);

    if (!Number.isFinite(cratesSold) || !Number.isFinite(looseEggs)) {
      throw new Error("Egg quantities must be valid numbers.");
    }

    if (cratesSold < 0 || looseEggs < 0) {
      throw new Error("Egg quantities cannot be negative.");
    }

    const cratePrice = Number(EGG_CATEGORY_PRICES[category]);

    const eggPrice = Math.round(cratePrice / EGGS_PER_CRATE);

    const subtotal = cratesSold * cratePrice + looseEggs * eggPrice;

    return {
      category,
      cratesSold,
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
  const cratesTotal =
    Number(sale.cratesSold || 0) * Number(sale.cratePrice || 0);

  const looseEggTotal =
    Number(sale.looseEggs || 0) * Number(sale.eggPrice || 0);

  return cratesTotal + looseEggTotal;
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
//
// IMPORTANT:
// This function does NOT combine payment rows.
//
// For example:
//
// [
//   { method: "Cash", amount: 10000 },
//   { method: "Cash", amount: 5000 },
//   { method: "Transfer", amount: 2000 }
// ]
//
// remains three separate payment records.
//

const normalizePayments = (payments) => {
  if (!Array.isArray(payments)) {
    return [];
  }

  return payments
    .map((payment) => {
      if (!payment) {
        return null;
      }

      const method = String(payment.method || "").trim();

      const amount = Number(payment.amount || 0);

      // Empty frontend row.
      if (!method && amount <= 0) {
        return null;
      }

      if (!VALID_PAYMENT_METHODS.includes(method)) {
        throw new Error(
          "Invalid payment method. Allowed methods are Cash, Transfer and POS.",
        );
      }

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Payment amounts must be valid non-negative numbers.");
      }

      // Ignore zero-value rows.
      if (amount === 0) {
        return null;
      }

      let paidAt = new Date();

      if (payment.paidAt) {
        const suppliedDate = new Date(payment.paidAt);

        if (!Number.isNaN(suppliedDate.getTime())) {
          paidAt = suppliedDate;
        }
      }

      return {
        method,
        amount,
        paidAt,
      };
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

  // Determine payment method from ALL payment rows.
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
//
// New API:
// payments: [
//   { method: "Cash", amount: 16000 },
//   { method: "Transfer", amount: 1400 }
// ]
//
// Legacy API:
// amountPaid: 17400
// paymentMethod: "Transfer"
//

const resolvePayments = ({ payments, amountPaid, paymentMethod }) => {
  // New segmented-payment request.
  if (Array.isArray(payments)) {
    return normalizePayments(payments);
  }

  // Legacy payment request.
  const legacyAmount = Number(amountPaid || 0);

  if (!Number.isFinite(legacyAmount) || legacyAmount < 0) {
    throw new Error("Invalid amount paid.");
  }

  if (legacyAmount === 0) {
    return [];
  }

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
    .sort({
      invoiceNumber: -1,
    })
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
// GET ALL SALES
// =====================================================

exports.getSales = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    let filter;

    if (isSuperadmin) {
      filter = {};
    } else {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      filter = {
        isDeleted: false,
        createdAt: {
          $gte: cutoff,
        },
      };
    }

    const sales = await EggSale.find(filter)
      .sort({
        date: -1,
        createdAt: -1,
      })
      .populate("customerId", "name phone email address customerType isActive")
      .populate("deletedBy", "role name")
      .populate("soldBy", "role name");

    res.json(sales);
  } catch (err) {
    console.error("GET SALES ERROR:", err);

    res.status(500).json({
      message: err.message,
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

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    res.json(sale);
  } catch (err) {
    console.error("GET SINGLE SALE ERROR:", err);

    res.status(500).json({
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

    // ---------------------------------------------------
    // CUSTOMER
    // ---------------------------------------------------

    const resolvedCustomer = await resolveCustomer({
      customerId,
      customer,
      phone,
    });

    // ---------------------------------------------------
    // DATE
    // ---------------------------------------------------

    const saleDate = date ? new Date(`${date}T12:00:00`) : new Date();

    if (Number.isNaN(saleDate.getTime())) {
      return res.status(400).json({
        message: "Invalid sale date.",
      });
    }

    // ---------------------------------------------------
    // LINE ITEMS
    // ---------------------------------------------------

    const validatedLineItems = buildValidatedLineItems(lineItems);

    // ---------------------------------------------------
    // TOTAL
    // ---------------------------------------------------

    const totalAmount = calculateTotal(
      validatedLineItems,
      transportCharge,
      discount,
    );

    // ---------------------------------------------------
    // PAYMENTS
    // ---------------------------------------------------

    const resolvedPayments = resolvePayments({
      payments,
      amountPaid,
      paymentMethod,
    });

    const paymentSummary = calculatePayment(totalAmount, resolvedPayments);

    // ---------------------------------------------------
    // INVOICE
    // ---------------------------------------------------

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

          // IMPORTANT:
          // Store every individual payment row.
          payments: resolvedPayments,

          // Compatibility total.
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

    res.status(201).json(sale);
  } catch (err) {
    console.error("CREATE SALE ERROR:", err);

    res.status(400).json({
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

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
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

    // ---------------------------------------------------
    // CUSTOMER
    // ---------------------------------------------------

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

    // ---------------------------------------------------
    // DATE
    // ---------------------------------------------------

    if (date !== undefined) {
      const newDate = new Date(`${date}T12:00:00`);

      if (Number.isNaN(newDate.getTime())) {
        return res.status(400).json({
          message: "Invalid sale date.",
        });
      }

      sale.date = newDate;
    }

    // ---------------------------------------------------
    // LINE ITEMS
    // ---------------------------------------------------

    if (lineItems !== undefined) {
      sale.lineItems = buildValidatedLineItems(lineItems);
    }

    // ---------------------------------------------------
    // DISCOUNT
    // ---------------------------------------------------

    if (discount !== undefined) {
      const value = Number(discount || 0);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          message: "Invalid discount amount.",
        });
      }

      sale.discount = Math.max(0, value);
    }

    // ---------------------------------------------------
    // TRANSPORT
    // ---------------------------------------------------

    if (transportCharge !== undefined) {
      const value = Number(transportCharge || 0);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          message: "Invalid transport charge.",
        });
      }

      sale.transportCharge = Math.max(0, value);
    }

    // ---------------------------------------------------
    // RECALCULATE TOTAL
    // ---------------------------------------------------

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

    // ===================================================
    // PAYMENT UPDATE
    // ===================================================

    if (Array.isArray(payments)) {
      // New segmented payment system.
      //
      // IMPORTANT:
      // Every row is preserved.

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
      // -------------------------------------------------
      // LEGACY SINGLE PAYMENT UPDATE
      // -------------------------------------------------

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
      // -------------------------------------------------
      // NO PAYMENT DATA SENT
      // -------------------------------------------------
      //
      // Preserve existing segmented payments.

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

    // ---------------------------------------------------
    // REMARKS
    // ---------------------------------------------------

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

    res.json(sale);
  } catch (err) {
    console.error("UPDATE SALE ERROR:", err);

    res.status(400).json({
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
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    sale.isDeleted = true;
    sale.deletedAt = new Date();
    sale.deletedBy = req.user?.id || null;

    await sale.save({
      validateBeforeSave: false,
    });

    res.json({
      message: "Sale deleted successfully",
    });
  } catch (err) {
    console.error("DELETE SALE ERROR:", err);

    res.status(500).json({
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
      .sort({
        deletedAt: -1,
      })
      .populate("customerId", "name phone email address customerType")
      .populate("deletedBy", "role name")
      .populate("soldBy", "role name");

    res.json(sales);
  } catch (err) {
    console.error("GET DELETED SALES ERROR:", err);

    res.status(500).json({
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

    res.json(sale);
  } catch (err) {
    console.error("RESTORE SALE ERROR:", err);

    res.status(500).json({
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

    const sales = await EggSale.find({
      customerId,
      isDeleted: false,
    })
      .sort({
        date: -1,
        createdAt: -1,
      })
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

    res.json({
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

    res.status(500).json({
      message: err.message,
    });
  }
};
