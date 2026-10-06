const Production = require("../models/Production");
const Flock = require("../models/Flock");
// ============================================================
// CONSTANTS
// ============================================================

const BROODING_HOUSE = "Brooding House";
const MAX_LAYING_AGE_WEEKS = 104;

// ============================================================
// HELPERS
// ============================================================

/**
 * Calculate a flock's age in completed weeks on a specific date.
 *
 * Age =
 * startingAgeWeeks + completed weeks since placementDate
 */
const calculateFlockAgeWeeks = (flock, productionDate) => {
  if (!flock) {
    return null;
  }

  const placementDate = new Date(flock.placementDate);
  const recordDate = new Date(productionDate);

  if (
    Number.isNaN(placementDate.getTime()) ||
    Number.isNaN(recordDate.getTime())
  ) {
    return null;
  }

  const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

  const elapsedMilliseconds = recordDate.getTime() - placementDate.getTime();

  // A production record before flock placement is invalid
  // for that flock.
  if (elapsedMilliseconds < 0) {
    return null;
  }

  const elapsedWeeks = Math.floor(elapsedMilliseconds / millisecondsPerWeek);

  return Math.max(0, Number(flock.startingAgeWeeks || 0) + elapsedWeeks);
};

/**
 * Find the flock that should be associated with a production
 * record for the specified pen and production date.
 *
 * Historical rule:
 *
 * A flock is considered to have occupied the pen if:
 *
 * placementDate <= productionDate
 *
 * and:
 *
 * - it is still ACTIVE, OR
 * - it was SOLD after the production date.
 *
 * This prevents a later flock from being incorrectly attached
 * to an older production record.
 *
 * Brooding House intentionally does not require a flock.
 */
const getProductionFlockData = async (pen, productionDate) => {
  if (!pen || pen === BROODING_HOUSE) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
    };
  }

  const recordDate = new Date(productionDate);

  if (Number.isNaN(recordDate.getTime())) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
    };
  }

  // ----------------------------------------------------------
  // First try an ACTIVE flock.
  //
  // This is the normal path for new production records.
  // ----------------------------------------------------------

  const activeFlock = await Flock.findOne({
    pen,
    status: "ACTIVE",
    isDeleted: false,
    placementDate: {
      $lte: recordDate,
    },
  }).sort({
    placementDate: -1,
  });

  if (activeFlock) {
    const flockAgeWeeks = calculateFlockAgeWeeks(activeFlock, recordDate);

    return {
      flock: activeFlock._id,
      flockId: activeFlock.flockId,
      flockAgeWeeks,
    };
  }

  // ----------------------------------------------------------
  // If there is no active flock, look for a SOLD flock that
  // occupied the pen on the production date.
  // ----------------------------------------------------------

  const historicalFlock = await Flock.findOne({
    pen,
    isDeleted: false,
    status: "SOLD",
    placementDate: {
      $lte: recordDate,
    },
    saleDate: {
      $gte: recordDate,
    },
  }).sort({
    placementDate: -1,
  });

  if (!historicalFlock) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
    };
  }

  const flockAgeWeeks = calculateFlockAgeWeeks(historicalFlock, recordDate);

  return {
    flock: historicalFlock._id,
    flockId: historicalFlock.flockId,
    flockAgeWeeks,
  };
};

// ============================================================
// GET ALL PRODUCTION RECORDS
// ============================================================

const getProductions = async (req, res) => {
  try {
    console.log("GET PRODUCTIONS HIT");

    let productions;

    // ----------------------------------------------------------
    // SUPERADMIN SEES EVERYTHING
    // ----------------------------------------------------------

    if (req.user.role === "superadmin") {
      productions = await Production.find()
        .populate(
          "flock",
          "flockId pen placementDate startingAgeWeeks status saleDate",
        )
        .sort({
          date: -1,
        });
    } else {
      // --------------------------------------------------------
      // STAFF + MANAGER DO NOT SEE DELETED RECORDS
      // --------------------------------------------------------

      productions = await Production.find({
        isDeleted: false,
      })
        .populate(
          "flock",
          "flockId pen placementDate startingAgeWeeks status saleDate",
        )
        .sort({
          date: -1,
        });
    }

    console.log("FOUND:", productions.length);

    res.json(productions);
  } catch (err) {
    console.log("PRODUCTION ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// GET SINGLE PRODUCTION RECORD
// ============================================================

const getProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id).populate(
      "flock",
      "flockId pen placementDate startingAgeWeeks status saleDate",
    );

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    res.json(production);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// CREATE PRODUCTION RECORD
// ============================================================

const createProduction = async (req, res) => {
  try {
    console.log("CREATE PRODUCTION:", req.body);

    const {
      openingStock,
      transferIn,
      transferOut,
      mortality,
      cratesProduced,
      extraEggPieces,
      pen,
      date,
    } = req.body;

    // ----------------------------------------------------------
    // FLOCK ASSOCIATION
    // ----------------------------------------------------------
    //
    // The backend determines the flock from the pen and date.
    //
    // The frontend is NOT trusted to provide:
    //
    // flock
    // flockId
    // flockAgeWeeks
    //
    // Brooding House intentionally has no flock association.
    // ----------------------------------------------------------

    const flockData = await getProductionFlockData(pen, date);

    // ----------------------------------------------------------
    // STOCK CALCULATION
    // ----------------------------------------------------------

    const closingStock =
      Number(openingStock || 0) +
      Number(transferIn || 0) -
      Number(transferOut || 0) -
      Number(mortality || 0);

    if (closingStock < 0) {
      return res.status(400).json({
        message:
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      });
    }

    // ----------------------------------------------------------
    // EGG CALCULATION
    // ----------------------------------------------------------

    const totalEggs =
      Number(cratesProduced || 0) * 30 + Number(extraEggPieces || 0);

    const productionPercentage =
      closingStock > 0
        ? Number(((totalEggs / closingStock) * 100).toFixed(2))
        : 0;

    // ----------------------------------------------------------
    // CREATE
    // ----------------------------------------------------------

    const production = await Production.create({
      ...req.body,

      // NEVER TRUST FRONTEND FLOCK DATA
      flock: flockData.flock,
      flockId: flockData.flockId,
      flockAgeWeeks: flockData.flockAgeWeeks,

      closingStock,
      totalEggs,
      productionPercentage,
    });

    // ----------------------------------------------------------
    // RETURN POPULATED RECORD
    // ----------------------------------------------------------

    const populatedProduction = await Production.findById(
      production._id,
    ).populate(
      "flock",
      "flockId pen placementDate startingAgeWeeks status saleDate",
    );

    res.status(201).json(populatedProduction);
  } catch (err) {
    console.log("CREATE PRODUCTION ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// UPDATE PRODUCTION RECORD
// ============================================================

const updateProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    // ----------------------------------------------------------
    // UPDATE USER-SUPPLIED PRODUCTION FIELDS
    // ----------------------------------------------------------

    Object.assign(production, req.body);

    // ----------------------------------------------------------
    // FLOCK ASSOCIATION
    // ----------------------------------------------------------
    //
    // Recalculate from the final pen/date values.
    //
    // The frontend still cannot override flock information.
    // ----------------------------------------------------------

    const flockData = await getProductionFlockData(
      production.pen,
      production.date,
    );

    production.flock = flockData.flock;
    production.flockId = flockData.flockId;
    production.flockAgeWeeks = flockData.flockAgeWeeks;

    // ----------------------------------------------------------
    // STOCK CALCULATION
    // ----------------------------------------------------------

    const openingStock = Number(production.openingStock || 0);

    const transferIn = Number(production.transferIn || 0);

    const transferOut = Number(production.transferOut || 0);

    const mortality = Number(production.mortality || 0);

    const closingStock = openingStock + transferIn - transferOut - mortality;

    if (closingStock < 0) {
      return res.status(400).json({
        message:
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      });
    }

    production.closingStock = closingStock;

    // ----------------------------------------------------------
    // EGG CALCULATION
    // ----------------------------------------------------------

    const cratesProduced = Number(production.cratesProduced || 0);

    const extraEggPieces = Number(production.extraEggPieces || 0);

    production.totalEggs = cratesProduced * 30 + extraEggPieces;

    production.productionPercentage =
      production.closingStock > 0
        ? Number(
            ((production.totalEggs / production.closingStock) * 100).toFixed(2),
          )
        : 0;

    // ----------------------------------------------------------
    // SAVE
    // ----------------------------------------------------------

    await production.save();

    // ----------------------------------------------------------
    // RETURN POPULATED RECORD
    // ----------------------------------------------------------

    const populatedProduction = await Production.findById(
      production._id,
    ).populate(
      "flock",
      "flockId pen placementDate startingAgeWeeks status saleDate",
    );

    res.json(populatedProduction);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    console.log("UPDATE PRODUCTION ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// SOFT DELETE RECORD
// ============================================================

const deleteProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    // ----------------------------------------------------------
    // SUPERADMIN = PERMANENT DELETE
    // ----------------------------------------------------------

    if (req.user.role === "superadmin") {
      await Production.findByIdAndDelete(req.params.id);

      return res.json({
        message: "Production permanently deleted",
      });
    }

    // ----------------------------------------------------------
    // MANAGER / STAFF = SOFT DELETE
    // ----------------------------------------------------------

    production.isDeleted = true;

    production.deletedBy = {
      id: req.user.id,
      name: req.user.name,
      role: req.user.role,
    };

    production.deletedAt = new Date();

    await production.save();

    res.json({
      message: "Production deleted successfully",
    });
  } catch (err) {
    console.log("DELETE PRODUCTION ERROR:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getProductions,
  getProduction,
  createProduction,
  updateProduction,
  deleteProduction,
};
