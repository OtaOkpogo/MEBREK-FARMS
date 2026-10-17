const Production = require("../models/Production");
const Flock = require("../models/Flock");
const Mortality = require("../models/Mortality");

const {
  softDeleteLinkedBirdHealth,
  syncLinkedBirdHealth,
} = require("../services/healthSyncService");

const BROODING_HOUSE = "Brooding House";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Normalize a value to the start of its UTC calendar day.
const toUtcDay = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const getDayDate = (value) => {
  const day = toUtcDay(value);
  return day === null ? null : new Date(day);
};

// ------------------------------------------------------------
// FLOCK CALCULATIONS
// ------------------------------------------------------------

const calculateFlockAgeWeeks = (flock, productionDate) => {
  if (!flock) return null;

  const placementDay = toUtcDay(flock.placementDate);
  const productionDay = toUtcDay(productionDate);

  if (placementDay === null || productionDay === null) return null;
  if (productionDay < placementDay) return null;

  const elapsedDays = Math.floor((productionDay - placementDay) / DAY_MS);

  return Math.max(
    0,
    Number(flock.startingAgeWeeks || 0) + Math.floor(elapsedDays / 7),
  );
};

const calculateFlockAgeDays = (flock, productionDate) => {
  if (!flock) return null;

  const placementDay = toUtcDay(flock.placementDate);
  const productionDay = toUtcDay(productionDate);

  if (placementDay === null || productionDay === null) return null;
  if (productionDay < placementDay) return null;

  const elapsedDays = Math.floor((productionDay - placementDay) / DAY_MS);

  return Number(flock.startingAgeWeeks || 0) * 7 + elapsedDays;
};

const getProductionFlockData = async (pen, productionDate) => {
  if (!pen || pen === BROODING_HOUSE) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
      days: null,
    };
  }

  const recordDay = toUtcDay(productionDate);

  if (recordDay === null) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
      days: null,
    };
  }

  const recordDate = new Date(recordDay);

  const activeFlock = await Flock.findOne({
    pen,
    status: "ACTIVE",
    isDeleted: false,
    placementDate: { $lte: recordDate },
  }).sort({ placementDate: -1 });

  let flock = activeFlock;

  if (!flock) {
    flock = await Flock.findOne({
      pen,
      isDeleted: false,
      status: "SOLD",
      placementDate: { $lte: recordDate },
      saleDate: { $gte: recordDate },
    }).sort({ placementDate: -1 });
  }

  if (!flock) {
    return {
      flock: null,
      flockId: null,
      flockAgeWeeks: null,
      days: null,
    };
  }

  return {
    flock: flock._id,
    flockId: flock.flockId,
    flockAgeWeeks: calculateFlockAgeWeeks(flock, recordDate),
    days: calculateFlockAgeDays(flock, recordDate),
  };
};

// ------------------------------------------------------------
// PRODUCTION TOTALS
// ------------------------------------------------------------

const calculateProductionTotals = (production) => {
  const openingStock = Number(production.openingStock || 0);
  const transferIn = Number(production.transferIn || 0);
  const transferOut = Number(production.transferOut || 0);
  const mortality = Number(production.mortality || 0);

  const closingStock = openingStock + transferIn - transferOut - mortality;

  const totalEggs =
    Number(production.cratesProduced || 0) * 30 +
    Number(production.extraEggPieces || 0);

  const productionPercentage =
    closingStock > 0
      ? Number(((totalEggs / closingStock) * 100).toFixed(2))
      : 0;

  return {
    closingStock,
    totalEggs,
    productionPercentage,
  };
};

// ------------------------------------------------------------
// STOCK CARRY-FORWARD
// ------------------------------------------------------------

// Find the most recent earlier, active record for the SAME pen.
// A deleted record must never provide the next opening stock.
const getPreviousProduction = async (pen, productionDate, excludeId = null) => {
  const day = toUtcDay(productionDate);

  if (!pen || day === null) return null;

  const filter = {
    pen,
    isDeleted: false,
    date: { $lt: new Date(day) },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Production.findOne(filter).sort({
    date: -1,
    _id: -1,
  });
};

// Recalculate active records after a given date using the supplied
// closing stock as the next opening stock.
const recalculateRecordsAfter = async (
  pen,
  productionDate,
  startingClosingStock,
) => {
  const day = toUtcDay(productionDate);

  if (!pen || day === null) return;

  const records = await Production.find({
    pen,
    isDeleted: false,
    date: { $gt: new Date(day) },
  }).sort({ date: 1, _id: 1 });

  let previousClosingStock = Number(startingClosingStock);

  for (const record of records) {
    record.openingStock = previousClosingStock;

    const totals = calculateProductionTotals(record);

    if (totals.closingStock < 0) {
      throw new Error(
        `Stock recalculation would make the closing stock negative for ${record.pen} on ${getDayDate(record.date).toISOString().slice(0, 10)}. Review transfers and mortality for that record.`,
      );
    }

    Object.assign(record, totals);

    await record.save();

    previousClosingStock = record.closingStock;
  }
};

// Rebuild a pen's history from a date after a record is moved or removed.
// If an earlier active record exists, use its closing stock. Otherwise,
// preserve the first remaining record's manually entered opening stock.
const recalculatePenFromDate = async (pen, fromDate) => {
  const day = toUtcDay(fromDate);

  if (!pen || day === null) return;

  const previous = await Production.findOne({
    pen,
    isDeleted: false,
    date: { $lt: new Date(day) },
  }).sort({ date: -1, _id: -1 });

  const records = await Production.find({
    pen,
    isDeleted: false,
    date: { $gte: new Date(day) },
  }).sort({ date: 1, _id: 1 });

  if (!records.length) return;

  let previousClosingStock =
    previous === null ? null : Number(previous.closingStock);

  for (const record of records) {
    // Preserve the manually entered starting stock if this is now the
    // first active record in the pen's history.
    if (previousClosingStock !== null) {
      record.openingStock = previousClosingStock;
    }

    const totals = calculateProductionTotals(record);

    if (totals.closingStock < 0) {
      throw new Error(
        `Stock recalculation would make the closing stock negative for ${record.pen} on ${getDayDate(record.date).toISOString().slice(0, 10)}. Review transfers and mortality for that record.`,
      );
    }

    Object.assign(record, totals);
    await record.save();

    previousClosingStock = record.closingStock;
  }
};

// ------------------------------------------------------------
// MORTALITY AND BIRD HEALTH SYNCHRONISATION
// ------------------------------------------------------------

const buildMortalityHealthPayload = (mortality) => ({
  date: mortality.date || new Date(),
  pen: mortality.birdBatch,
  healthIssue: mortality.cause,
  category: "Mortality",
  symptoms: `${mortality.numberDead} bird(s) died`,
  diagnosis: mortality.cause,
  actionTaken: "Mortality recorded from Production",
  birdsAffected: mortality.numberDead || 0,
  severity: "Critical",
  status: "Dead",
  remarks: mortality.notes || "",
});

const removeLinkedMortality = async (production, req) => {
  let mortality = production.mortalityRecord
    ? await Mortality.findById(production.mortalityRecord)
    : null;

  if (!mortality) {
    mortality = await Mortality.findOne({
      productionRecord: production._id,
    });
  }

  if (!mortality) {
    production.mortalityRecord = null;
    return;
  }

  await softDeleteLinkedBirdHealth({
    sourceRecord: mortality,
    sourceLinkField: "birdHealthRecord",
    healthLinkField: "mortalityRecord",
    req,
  });

  await Mortality.findByIdAndDelete(mortality._id);

  production.mortalityRecord = null;
};

const syncProductionMortality = async (production, req) => {
  const numberDead = Number(production.mortality || 0);

  if (numberDead <= 0) {
    await removeLinkedMortality(production, req);
    return;
  }

  let mortality = production.mortalityRecord
    ? await Mortality.findById(production.mortalityRecord)
    : null;

  if (!mortality) {
    mortality = await Mortality.findOne({
      productionRecord: production._id,
    });
  }

  const mortalityData = {
    productionRecord: production._id,
    birdBatch: production.pen,
    numberDead,
    cause: "Production mortality",
    date: production.date,
    notes: `Automatically generated from Production record ${production._id}`,
  };

  if (mortality) {
    Object.assign(mortality, mortalityData);
    await mortality.save();
  } else {
    mortality = await Mortality.create(mortalityData);
  }

  production.mortalityRecord = mortality._id;
  await production.save({ validateModifiedOnly: true });

  await syncLinkedBirdHealth({
    sourceRecord: mortality,
    sourceLinkField: "birdHealthRecord",
    healthLinkField: "mortalityRecord",
    payload: buildMortalityHealthPayload(mortality),
    req,
  });
};

const populateProduction = (query) =>
  query.populate(
    "flock",
    "flockId pen placementDate startingAgeWeeks status saleDate",
  );

// ------------------------------------------------------------
// GET PRODUCTIONS
// ------------------------------------------------------------

exports.getProductions = async (req, res) => {
  try {
    const filter = req.user.role === "superadmin" ? {} : { isDeleted: false };

    const productions = await populateProduction(
      Production.find(filter).sort({ date: -1 }),
    );

    res.json(productions);
  } catch (err) {
    console.error("GET PRODUCTIONS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getProduction = async (req, res) => {
  try {
    const production = await populateProduction(
      Production.findById(req.params.id),
    );

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    if (req.user.role !== "superadmin" && production.isDeleted) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    res.json(production);
  } catch (err) {
    console.error("GET PRODUCTION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// ------------------------------------------------------------
// CREATE PRODUCTION
// ------------------------------------------------------------

exports.createProduction = async (req, res) => {
  try {
    const { pen, date } = req.body;
    const productionDate = getDayDate(date);

    if (!pen || !productionDate) {
      return res.status(400).json({
        message: "A valid production date and pen are required.",
      });
    }

    const previous = await getPreviousProduction(pen, productionDate);

    const flockData = await getProductionFlockData(pen, productionDate);

    const productionData = {
      ...req.body,
      date: productionDate,
      pen,
      flock: flockData.flock,
      flockId: flockData.flockId,
      flockAgeWeeks: flockData.flockAgeWeeks,

      // Automatically carry forward the previous closing stock.
      // For the first active record, retain the manually entered stock.
      openingStock:
        previous !== null
          ? Number(previous.closingStock)
          : Number(req.body.openingStock || 0),
    };

    if (flockData.days !== null) {
      productionData.days = flockData.days;
    }

    const totals = calculateProductionTotals(productionData);

    if (totals.closingStock < 0) {
      return res.status(400).json({
        message:
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      });
    }

    Object.assign(productionData, totals);

    const production = await Production.create(productionData);

    try {
      await syncProductionMortality(production, req);
    } catch (syncError) {
      console.error("Production → Mortality sync error:", syncError);
    }

    const result = await populateProduction(
      Production.findById(production._id),
    );

    res.status(201).json(result);
  } catch (err) {
    console.error("CREATE PRODUCTION ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    res.status(500).json({ message: err.message });
  }
};

// ------------------------------------------------------------
// UPDATE PRODUCTION
// ------------------------------------------------------------

exports.updateProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    if (req.user.role !== "superadmin" && production.isDeleted) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    const oldPen = production.pen;
    const oldDate = new Date(production.date);

    const protectedFields = [
      "_id",
      "flock",
      "flockId",
      "flockAgeWeeks",
      "mortalityRecord",
      "isDeleted",
      "deletedAt",
      "deletedBy",
      "closingStock",
      "totalEggs",
      "productionPercentage",
    ];

    for (const [key, value] of Object.entries(req.body)) {
      if (!protectedFields.includes(key)) {
        production[key] = value;
      }
    }

    const productionDate = getDayDate(production.date);

    if (!production.pen || !productionDate) {
      return res.status(400).json({
        message: "A valid production date and pen are required.",
      });
    }

    production.date = productionDate;

    const flockData = await getProductionFlockData(
      production.pen,
      production.date,
    );

    production.flock = flockData.flock;
    production.flockId = flockData.flockId;
    production.flockAgeWeeks = flockData.flockAgeWeeks;

    if (flockData.days !== null) {
      production.days = flockData.days;
    }

    const previous = await getPreviousProduction(
      production.pen,
      production.date,
      production._id,
    );

    // Use the earlier record's closing stock where one exists.
    // Otherwise, keep the manually entered starting stock.
    if (previous) {
      production.openingStock = Number(previous.closingStock);
    }

    const totals = calculateProductionTotals(production);

    if (totals.closingStock < 0) {
      return res.status(400).json({
        message:
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      });
    }

    Object.assign(production, totals);
    await production.save();

    try {
      await syncProductionMortality(production, req);
    } catch (syncError) {
      console.error("Production → Mortality sync error:", syncError);
    }

    // If the pen or date changed, rebuild the old pen's affected history.
    const oldDay = toUtcDay(oldDate);
    const newDay = toUtcDay(production.date);

    if (oldPen !== production.pen || oldDay !== newDay) {
      await recalculatePenFromDate(oldPen, oldDate);
    }

    // Update later records in the current pen using this record's closing stock.
    await recalculateRecordsAfter(
      production.pen,
      production.date,
      production.closingStock,
    );

    const result = await populateProduction(
      Production.findById(production._id),
    );

    res.json(result);
  } catch (err) {
    console.error("UPDATE PRODUCTION ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    res.status(500).json({ message: err.message });
  }
};

// ------------------------------------------------------------
// DELETE PRODUCTION
// ------------------------------------------------------------

exports.deleteProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

    const affectedPen = production.pen;
    const affectedDate = new Date(production.date);

    try {
      await removeLinkedMortality(production, req);
    } catch (syncError) {
      console.error("Production mortality cleanup error:", syncError);

      return res.status(500).json({
        message:
          "Could not safely remove the linked mortality record. Production was not deleted.",
      });
    }

    if (req.user.role === "superadmin") {
      await Production.findByIdAndDelete(production._id);
    } else {
      production.isDeleted = true;
      production.deletedBy = {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
      };
      production.deletedAt = new Date();

      await production.save({ validateModifiedOnly: true });
    }

    // The deleted record must no longer be used as a stock source.
    await recalculatePenFromDate(affectedPen, affectedDate);

    res.json({ message: "Production deleted successfully" });
  } catch (err) {
    console.error("DELETE PRODUCTION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
