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

// Use calendar dates in UTC to avoid daylight-saving/time-of-day
// differences affecting the number of elapsed days.
const toUtcDay = (value) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

// Flock age in completed weeks on the production date.
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

// Days is the flock's age in days on the production date.
// Example: 18 weeks old = 126 days.
const calculateFlockAgeDays = (flock, productionDate) => {
  if (!flock) return null;

  const placementDay = toUtcDay(flock.placementDate);
  const productionDay = toUtcDay(productionDate);

  if (placementDay === null || productionDay === null) return null;
  if (productionDay < placementDay) return null;

  const elapsedDays = Math.floor((productionDay - placementDay) / DAY_MS);

  const startingAgeDays = Number(flock.startingAgeWeeks || 0) * 7;

  return startingAgeDays + elapsedDays;
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

const calculateProductionTotals = (production) => {
  const closingStock =
    Number(production.openingStock || 0) +
    Number(production.transferIn || 0) -
    Number(production.transferOut || 0) -
    Number(production.mortality || 0);

  const totalEggs =
    Number(production.cratesProduced || 0) * 30 +
    Number(production.extraEggPieces || 0);

  const productionPercentage =
    closingStock > 0
      ? Number(((totalEggs / closingStock) * 100).toFixed(2))
      : 0;

  return { closingStock, totalEggs, productionPercentage };
};

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

exports.createProduction = async (req, res) => {
  try {
    const { pen, date } = req.body;

    const flockData = await getProductionFlockData(pen, date);

    const productionData = {
      ...req.body,
      flock: flockData.flock,
      flockId: flockData.flockId,
      flockAgeWeeks: flockData.flockAgeWeeks,
    };

    // Automatically calculate Days when a flock is found.
    // For the Brooding House or a pen without a matching flock,
    // retain the manually supplied value.
    if (flockData.days !== null) {
      productionData.days = flockData.days;
    }

    const totals = calculateProductionTotals(productionData);

    if (totals.closingStock < 0) {
      return res.status(400).json({
        message: "Closing stock cannot be negative",
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

    const protectedFields = [
      "_id",
      "flock",
      "flockId",
      "flockAgeWeeks",
      "mortalityRecord",
      "isDeleted",
      "deletedAt",
      "deletedBy",
    ];

    for (const [key, value] of Object.entries(req.body)) {
      if (!protectedFields.includes(key)) {
        production[key] = value;
      }
    }

    const flockData = await getProductionFlockData(
      production.pen,
      production.date,
    );

    production.flock = flockData.flock;
    production.flockId = flockData.flockId;
    production.flockAgeWeeks = flockData.flockAgeWeeks;

    // Recalculate on every edit so changing the pen or date
    // updates Days automatically.
    if (flockData.days !== null) {
      production.days = flockData.days;
    }

    const totals = calculateProductionTotals(production);

    if (totals.closingStock < 0) {
      return res.status(400).json({
        message: "Closing stock cannot be negative",
      });
    }

    Object.assign(production, totals);
    await production.save();

    try {
      await syncProductionMortality(production, req);
    } catch (syncError) {
      console.error("Production → Mortality sync error:", syncError);
    }

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

exports.deleteProduction = async (req, res) => {
  try {
    const production = await Production.findById(req.params.id);

    if (!production) {
      return res.status(404).json({
        message: "Production record not found",
      });
    }

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
      return res.json({ message: "Production permanently deleted" });
    }

    production.isDeleted = true;
    production.deletedBy = {
      id: req.user.id,
      name: req.user.name,
      role: req.user.role,
    };
    production.deletedAt = new Date();

    await production.save({ validateModifiedOnly: true });

    res.json({ message: "Production deleted successfully" });
  } catch (err) {
    console.error("DELETE PRODUCTION ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
