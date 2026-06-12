const Production = require("../models/Production");

// ==========================
// GET ALL PRODUCTION RECORDS
// ==========================
const getProductions = async (req, res) => {
  try {
    const productions = await Production.find().sort({
      date: -1,
    });

    res.json(productions);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ==========================
// CREATE PRODUCTION RECORD
// ==========================
const createProduction = async (req, res) => {
  try {
    const { openingStock, mortality, cratesProduced } = req.body;

    const closingStock = Number(openingStock || 0) - Number(mortality || 0);

    const totalEggs = Number(cratesProduced || 0) * 30;

    const productionPercentage =
      closingStock > 0
        ? Number(((totalEggs / closingStock) * 100).toFixed(2))
        : 0;

    const production = await Production.create({
      ...req.body,
      closingStock,
      totalEggs,
      productionPercentage,
    });

    res.status(201).json(production);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ==========================
// DELETE RECORD
// ==========================
const deleteProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    await Production.findByIdAndDelete(req.params.id);

    res.json({
      message: "Production record deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

module.exports = {
  getProductions,
  createProduction,
  deleteProduction,
};
