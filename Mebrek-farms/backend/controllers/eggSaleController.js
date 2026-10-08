const EggSale = require("../models/EggSale");
const Customer = require("../models/Customer");
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
    const category = String(item.category || "")
      .trim()
      .toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(EGG_CATEGORY_PRICES, category)) {
      throw new Error(`Unknown egg category: ${category}`);
    }

    // Prevent duplicate egg categories in the same sale.
    if (seenCategories.has(category)) {
      throw new Error(
        `The ${category} egg category has been entered more than once.`,
      );
    }

    seenCategories.add(category);

    const cratesSold = Number(item.cratesSold || 0);
    const looseEggs = Number(item.looseEggs || 0);

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
// Used for older sales that were created before lineItems
// were introduced.

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
  const paid = Math.max(0, Number(amountPaid || 0));

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
// RESOLVE CUSTOMER
// =====================================================
// If customerId is supplied, the sale is permanently
// linked to the Customer record.
//
// The customer name and phone are ALSO saved on the sale
// as historical snapshots. This means changing a customer's
// details later will not rewrite old invoices.

const resolveCustomer = async ({ customerId, customer, phone }) => {
  // ---------------------------------------------------
  // No customerId = legacy/manual customer entry
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // Customer ID supplied
  // ---------------------------------------------------

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
      // Superadmin sees active and deleted records
      // for audit purposes.
      filter = {};
    } else {
      // Other users see active records created
      // within the last 24 hours.
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
    // SALE DATE
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
    // PAYMENT
    // ---------------------------------------------------

    const paidAmount = Math.max(0, Number(amountPaid || 0));

    const { balance, status } = calculatePayment(totalAmount, paidAmount);

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

          // Snapshot customer details.
          customer: resolvedCustomer.customer,

          phone: resolvedCustomer.phone,

          date: saleDate,

          lineItems: validatedLineItems,

          discount: Math.max(0, Number(discount || 0)),

          transportCharge: Math.max(0, Number(transportCharge || 0)),

          totalAmount,

          amountPaid: paidAmount,

          balance,

          paymentMethod: paymentMethod || "Cash",

          status,

          remarks: String(remarks || "").trim(),

          soldBy: req.user?.id || null,
        });
      } catch (err) {
        // Invoice number collision.
        if (err.code === 11000 && attempts < maxAttempts) {
          continue;
        }

        throw err;
      }
    }

    if (!sale) {
      throw new Error("Unable to generate a unique invoice number.");
    }

    // Populate customer relationship before returning.
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
      remarks,
    } = req.body;

    // ---------------------------------------------------
    // CUSTOMER UPDATE
    // ---------------------------------------------------
    // If customerId is supplied, use the customer record.
    //
    // If customerId is explicitly empty/null, preserve
    // manual/legacy customer editing.

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
      // -------------------------------------------------
      // Backward-compatible manual editing.
      // -------------------------------------------------

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
      const validatedLineItems = buildValidatedLineItems(lineItems);

      sale.lineItems = validatedLineItems;
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
    // AMOUNT PAID
    // ---------------------------------------------------

    if (amountPaid !== undefined) {
      const value = Number(amountPaid || 0);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          message: "Invalid amount paid.",
        });
      }

      sale.amountPaid = Math.max(0, value);
    }

    // ---------------------------------------------------
    // PAYMENT METHOD
    // ---------------------------------------------------

    if (paymentMethod !== undefined) {
      sale.paymentMethod = paymentMethod;
    }

    // ---------------------------------------------------
    // REMARKS
    // ---------------------------------------------------

    if (remarks !== undefined) {
      sale.remarks = String(remarks || "").trim();
    }

    // ===================================================
    // RECALCULATE TOTAL
    // ===================================================

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

    // ===================================================
    // RECALCULATE PAYMENT
    // ===================================================

    const { balance, status } = calculatePayment(
      sale.totalAmount,
      sale.amountPaid,
    );

    sale.balance = balance;

    sale.status = status;

    // Existing records may contain legacy fields or
    // incomplete data, so preserve the original behavior
    // of allowing the save without forcing unrelated
    // validation failures.
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
// GET SALES FOR ONE CUSTOMER
// =====================================================
// Used by Egg Sales to show a customer's purchase
// history immediately after selecting the customer.
//
// Old sales created before customerId existed will
// naturally not appear here. They remain available in
// the normal sales list.

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
        "invoiceNumber customer phone date lineItems totalAmount amountPaid balance status paymentMethod",
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
