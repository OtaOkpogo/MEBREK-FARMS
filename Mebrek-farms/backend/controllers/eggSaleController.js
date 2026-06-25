const EggSale = require("../models/EggSale");

// =========================
// GET ALL SALES
// =========================

exports.getSales = async (req, res) => {
  try {
    const sales = await EggSale.find().sort({
      createdAt: -1,
    });

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

    const cratesTotal =
      Number(cratesSold || 0) * Number(cratePrice || 0);

    const looseEggTotal =
      Number(looseEggs || 0) * Number(eggPrice || 0);

    const totalAmount =
      cratesTotal +
      looseEggTotal +
      Number(transportCharge || 0) -
      Number(discount || 0);

    const balance =
      totalAmount - Number(amountPaid || 0);

    let status = "Unpaid";

    if (balance <= 0)
      status = "Paid";
    else if (amountPaid > 0)
      status = "Part Paid";

    const count = await EggSale.countDocuments();

    const invoiceNumber =
      `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    const sale = await EggSale.create({
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

    const cratesTotal =
      sale.cratesSold * sale.cratePrice;

    const looseEggTotal =
      sale.looseEggs * sale.eggPrice;

    sale.totalAmount =
      cratesTotal +
      looseEggTotal +
      sale.transportCharge -
      sale.discount;

    sale.balance =
      sale.totalAmount - sale.amountPaid;

    if (sale.balance <= 0)
      sale.status = "Paid";
    else if (sale.amountPaid > 0)
      sale.status = "Part Paid";
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
// DELETE SALE
// =========================

exports.deleteSale = async (req, res) => {
  try {
    await EggSale.findByIdAndDelete(req.params.id);

    res.json({
      message: "Sale deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};
