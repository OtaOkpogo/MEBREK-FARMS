const EggSale = require("../models/EggSale");
const { EGG_CATEGORY_PRICES } = require("../models/EggSale");

// =====================================================
// CONSTANTS
// =====================================================

const EGGS_PER_CRATE = 30;

// =====================================================
// EGG CATEGORY VALIDATION
// =====================================================

const buildValidatedLineItems = (lineItems) => {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error("At least one egg category is required.");
  }

  const seenCategories = new Set();

  return lineItems.map((item) => {
    const category = String(item.category || "").toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(EGG_CATEGORY_PRICES, category)) {
      throw new Error(`Unknown egg category: ${category}`);
    }

    // Prevent the same category from being entered twice.
    if (seenCategories.has(category)) {
      throw new Error(
        `The ${category} egg category has been entered more than once.`,
      );
    }

    seenCategories.add(category);

    const cratesSold = Number(item.cratesSold || 0);
    const looseEggs = Number(item.looseEggs || 0);

    if (cratesSold < 0 || looseEggs < 0) {
      throw new Error("Egg quantities cannot be negative.");
    }

    const cratePrice = EGG_CATEGORY_PRICES[category];

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
// Used only for old records that don't have lineItems.

const getLegacySaleTotal = (sale) => {
  const cratesTotal =
    Number(sale.cratesSold || 0) * Number(sale.cratePrice || 0);

  const looseEggTotal =
    Number(sale.looseEggs || 0) * Number(sale.eggPrice || 0);

  return cratesTotal + looseEggTotal;
};

// =====================================================
// CALCULATE TOTAL
// =====================================================

const calculateTotal = (lineItems, transportCharge = 0, discount = 0) => {
  const itemsTotal = lineItems.reduce(
    (sum, item) => sum + Number(item.subtotal || 0),
    0,
  );

  const totalAmount =
    itemsTotal + Number(transportCharge || 0) - Number(discount || 0);

  return Math.max(0, totalAmount);
};

// =====================================================
// PAYMENT STATUS
// =====================================================

const calculatePayment = (totalAmount, amountPaid) => {
  const paid = Number(amountPaid || 0);

  const balance = Math.max(0, totalAmount - paid);

  let status = "Unpaid";

  if (paid >= totalAmount && totalAmount > 0) {
    status = "Paid";
  } else if (paid > 0) {
    status = "Part Paid";
  }

  return {
    balance,
    status,
  };
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
// GET ALL SALES
// =====================================================

exports.getSales = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    let filter;

    if (isSuperadmin) {
      // Superadmin sees active and deleted records
      // for audit purposes.
      filter = {};
    } else {
      // Other users see only active records
      // entered in the last 24 hours.
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

    if (!customer?.trim()) {
      return res.status(400).json({
        message: "Customer name is required.",
      });
    }

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

    const { balance, status } = calculatePayment(totalAmount, amountPaid);

    const year = saleDate.getFullYear();

    let sale;

    let attempts = 0;

    const maxAttempts = 5;

    while (!sale && attempts < maxAttempts) {
      attempts++;

      const invoiceNumber = await generateInvoiceNumber(year);

      try {
        sale = await EggSale.create({
          invoiceNumber,
          customer: customer.trim(),
          phone: phone || "",
          date: saleDate,

          lineItems: validatedLineItems,

          discount: Number(discount || 0),

          transportCharge: Number(transportCharge || 0),

          totalAmount,

          amountPaid: Number(amountPaid || 0),

          balance,

          paymentMethod: paymentMethod || "Cash",

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

    if (!sale) {
      throw new Error("Unable to generate a unique invoice number.");
    }

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

    if (customer !== undefined) {
      sale.customer = customer.trim();
    }

    if (phone !== undefined) {
      sale.phone = phone;
    }

    if (date !== undefined) {
      const newDate = new Date(`${date}T12:00:00`);

      if (Number.isNaN(newDate.getTime())) {
        return res.status(400).json({
          message: "Invalid sale date.",
        });
      }

      sale.date = newDate;
    }

    if (lineItems !== undefined) {
      const validatedLineItems = buildValidatedLineItems(lineItems);

      sale.lineItems = validatedLineItems;
    }

    if (discount !== undefined) {
      sale.discount = Number(discount || 0);
    }

    if (transportCharge !== undefined) {
      sale.transportCharge = Number(transportCharge || 0);
    }

    if (amountPaid !== undefined) {
      sale.amountPaid = Number(amountPaid || 0);
    }

    if (paymentMethod !== undefined) {
      sale.paymentMethod = paymentMethod;
    }

    if (remarks !== undefined) {
      sale.remarks = remarks;
    }

    // =================================================
    // RECALCULATE
    // =================================================

    let itemsTotal = 0;

    if (Array.isArray(sale.lineItems) && sale.lineItems.length > 0) {
      itemsTotal = sale.lineItems.reduce(
        (sum, item) => sum + Number(item.subtotal || 0),
        0,
      );
    } else {
      // Legacy sale support.
      itemsTotal = getLegacySaleTotal(sale);
    }

    sale.totalAmount = Math.max(
      0,
      itemsTotal +
        Number(sale.transportCharge || 0) -
        Number(sale.discount || 0),
    );

    const { balance, status } = calculatePayment(
      sale.totalAmount,
      sale.amountPaid,
    );

    sale.balance = balance;

    sale.status = status;

    await sale.save({
      validateBeforeSave: false,
    });

    res.json(sale);
  } catch (err) {
    console.error("UPDATE SALE ERROR:", err);

    res.status(400).json({
      message: err.message,
    });
  }
};

// =====================================================
// DELETE SALE — SOFT DELETE
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

    sale.deletedBy = req.user?.id;

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
      .populate("deletedBy", "role name");

    res.json(sales);
  } catch (err) {
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

    res.json(sale);
  } catch (err) {
    console.error("RESTORE SALE ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};
