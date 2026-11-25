const mongoose = require("mongoose");

const Production = require("../models/Production");
const Flock = require("../models/Flock");
const FlockAllocation = require("../models/FlockAllocation");
const FlockPopulationHistory = require("../models/FlockPopulationHistory");
const Mortality = require("../models/Mortality");

const {
  syncMortalityPopulation,
  reverseMortalityPopulation,
} = require("../services/flockPopulationService");

const {
  softDeleteLinkedBirdHealth,
  syncLinkedBirdHealth,
} = require("../services/healthSyncService");

const { logAudit } = require("../utils/auditLogger");

const BROODING_HOUSE = "Brooding House";

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// DATE HELPERS
// ------------------------------------------------------------

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

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// ------------------------------------------------------------
// QUERY SESSION HELPER
// ------------------------------------------------------------

const withSession = (query, session) => {
  return session ? query.session(session) : query;
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

const getProductionFlockData = async (pen, productionDate, session = null) => {
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

  let activeQuery = Flock.findOne({
    pen,
    status: "ACTIVE",
    isDeleted: false,
    placementDate: { $lte: recordDate },
  }).sort({ placementDate: -1 });

  let activeFlock = await withSession(activeQuery, session);

  let flock = activeFlock;

  if (!flock) {
    const soldQuery = Flock.findOne({
      pen,
      isDeleted: false,
      status: "SOLD",
      placementDate: { $lte: recordDate },
      saleDate: { $gte: recordDate },
    }).sort({ placementDate: -1 });

    flock = await withSession(soldQuery, session);
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

const getPreviousProduction = async (
  pen,
  productionDate,
  excludeId = null,
  session = null,
) => {
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

  const query = Production.findOne(filter).sort({
    date: -1,
    _id: -1,
  });

  return withSession(query, session);
};

const recalculateRecordsAfter = async (
  pen,
  productionDate,
  startingClosingStock,
  session = null,
) => {
  const day = toUtcDay(productionDate);

  if (!pen || day === null) return;

  const query = Production.find({
    pen,
    isDeleted: false,
    date: { $gt: new Date(day) },
  }).sort({ date: 1, _id: 1 });

  const records = await withSession(query, session);

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

    await record.save(session ? { session } : {});

    previousClosingStock = record.closingStock;
  }
};

const recalculatePenFromDate = async (pen, fromDate, session = null) => {
  const day = toUtcDay(fromDate);

  if (!pen || day === null) return;

  const previousQuery = Production.findOne({
    pen,
    isDeleted: false,
    date: { $lt: new Date(day) },
  }).sort({ date: -1, _id: -1 });

  const previous = await withSession(previousQuery, session);

  const recordsQuery = Production.find({
    pen,
    isDeleted: false,
    date: { $gte: new Date(day) },
  }).sort({ date: 1, _id: 1 });

  const records = await withSession(recordsQuery, session);

  if (!records.length) return;

  let previousClosingStock =
    previous === null ? null : Number(previous.closingStock);

  for (const record of records) {
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

    await record.save(session ? { session } : {});

    previousClosingStock = record.closingStock;
  }
};

// ------------------------------------------------------------
// AUDIT SNAPSHOT
// ------------------------------------------------------------

const getProductionAuditSnapshot = (production) => {
  if (!production) return null;

  return {
    date: production.date,
    pen: production.pen,
    flock: production.flock?._id || production.flock || null,
    flockId: production.flockId,
    flockAgeWeeks: production.flockAgeWeeks,
    days: production.days,
    openingStock: production.openingStock,
    transferIn: production.transferIn,
    transferOut: production.transferOut,
    mortality: production.mortality,
    mortalityAllocations: (production.mortalityAllocations || []).map(
      (item) => ({
        allocation: item.allocation,
        numberDead: item.numberDead,
      }),
    ),
    closingStock: production.closingStock,
    sickBirds: production.sickBirds,
    feedBagsConsumed: production.feedBagsConsumed,
    waterConsumed: production.waterConsumed,
    drugsUsed: production.drugsUsed,
    cratesProduced: production.cratesProduced,
    extraEggPieces: production.extraEggPieces,
    totalEggs: production.totalEggs,
    productionPercentage: production.productionPercentage,
    miscarriageProduction: production.miscarriageProduction,
    crackedEggs: production.crackedEggs,
    remarks: production.remarks,
    isDeleted: production.isDeleted,
  };
};

// ------------------------------------------------------------
// REQUEST VALIDATION
// ------------------------------------------------------------

const validateProductionMortality = (production) => {
  const mortality = Number(production.mortality || 0);

  if (!Number.isInteger(mortality) || mortality < 0) {
    throw new Error(
      "Production mortality must be a non-negative whole number.",
    );
  }

  const allocations = production.mortalityAllocations || [];

  if (!Array.isArray(allocations)) {
    throw new Error("Mortality allocations must be an array.");
  }

  if (mortality === 0 && allocations.length > 0) {
    throw new Error(
      "Mortality allocations must be empty when production mortality is zero.",
    );
  }

  if (mortality > 0 && allocations.length === 0) {
    throw new Error(
      "You must assign production mortality to one or more flock allocations.",
    );
  }

  const seenAllocations = new Set();

  let totalAllocated = 0;

  for (const item of allocations) {
    if (!item || !isValidObjectId(item.allocation)) {
      throw new Error(
        "Every mortality entry must contain a valid flock allocation ID.",
      );
    }

    const allocationId = String(item.allocation);

    if (seenAllocations.has(allocationId)) {
      throw new Error(
        "A flock allocation cannot appear more than once in the mortality breakdown.",
      );
    }

    seenAllocations.add(allocationId);

    const numberDead = Number(item.numberDead);

    if (!Number.isInteger(numberDead) || numberDead <= 0) {
      throw new Error(
        "Each mortality allocation must contain a positive whole number of dead birds.",
      );
    }

    totalAllocated += numberDead;
  }

  if (totalAllocated !== mortality) {
    throw new Error(
      `The mortality allocation total (${totalAllocated}) must equal the production mortality (${mortality}).`,
    );
  }
};

// ------------------------------------------------------------
// MORTALITY HEALTH PAYLOAD
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

// ------------------------------------------------------------
// LEGACY MORTALITY SAFETY
// ------------------------------------------------------------

const validateLegacyMortalityHasNoPopulationHistory = async (
  mortality,
  session,
) => {
  if (mortality.allocation) return;

  const history = await FlockPopulationHistory.findOne({
    sourceType: "PRODUCTION",
    sourceId: mortality._id,
  }).session(session);

  if (history) {
    throw new Error(
      `Legacy mortality record ${mortality._id} has population history but no allocation reference. It must be reconciled before this production record can be changed or deleted.`,
    );
  }
};

// ------------------------------------------------------------
// ALLOCATION VALIDATION
// ------------------------------------------------------------

const validateProductionAllocations = async ({
  production,
  existingMortalityRecords,
  session,
}) => {
  const requested = production.mortalityAllocations || [];

  const existingByAllocation = new Map();

  for (const record of existingMortalityRecords) {
    if (!record.allocation) {
      await validateLegacyMortalityHasNoPopulationHistory(record, session);
      continue;
    }

    const id = String(record.allocation);

    if (existingByAllocation.has(id)) {
      throw new Error(
        `Multiple existing mortality records reference allocation ${id}. Reconcile these records before continuing.`,
      );
    }

    existingByAllocation.set(id, record);
  }

  const validated = [];

  for (const item of requested) {
    const allocationId = item.allocation;
    const allocation =
      await FlockAllocation.findById(allocationId).session(session);

    if (!allocation) {
      throw new Error(`Flock allocation ${allocationId} was not found.`);
    }

    if (allocation.pen !== production.pen) {
      throw new Error(
        `Allocation ${allocationId} belongs to ${allocation.pen}, not ${production.pen}.`,
      );
    }

    const allocationDay = toUtcDay(allocation.allocationDate);
    const productionDay = toUtcDay(production.date);

    if (
      allocationDay === null ||
      productionDay === null ||
      productionDay < allocationDay
    ) {
      throw new Error(
        `The production date cannot be earlier than the allocation date for ${allocation.pen}.`,
      );
    }

    const existing = existingByAllocation.get(String(allocationId));

    if (!existing && allocation.status !== "ACTIVE") {
      throw new Error(
        `New mortality cannot be assigned to the closed allocation in ${allocation.pen}.`,
      );
    }

    if (allocation.status !== "ACTIVE" && allocation.status !== "CLOSED") {
      throw new Error(`Allocation ${allocationId} has an invalid status.`);
    }

    if (allocation.currentBirds === null) {
      throw new Error(
        `The population of allocation ${allocationId} is unknown. Establish its population before recording mortality.`,
      );
    }

    validated.push({
      allocation,
      numberDead: Number(item.numberDead),
      existingMortality: existing || null,
    });
  }

  return {
    validated,
    existingByAllocation,
  };
};

// ------------------------------------------------------------
// SYNCHRONISE PRODUCTION MORTALITY
// ------------------------------------------------------------

/**
 * Must be called inside the production MongoDB transaction.
 *
 * Every mortality source gets its own Mortality document ID.
 * That ID is used as the population-history sourceId.
 */
const syncProductionMortality = async ({ production, req, session }) => {
  validateProductionMortality(production);

  const existingMortalityRecords = await Mortality.find({
    productionRecord: production._id,
  }).session(session);

  const { validated, existingByAllocation } =
    await validateProductionAllocations({
      production,
      existingMortalityRecords,
      session,
    });

  const retainedIds = new Set();
  const healthSyncRecords = [];
  const healthDeleteRecords = [];

  for (const item of validated) {
    const { allocation, numberDead, existingMortality } = item;

    let mortalityRecord = existingMortality;

    if (mortalityRecord) {
      mortalityRecord.flock = allocation.flock;
      mortalityRecord.allocation = allocation._id;
      mortalityRecord.productionRecord = production._id;
      mortalityRecord.birdBatch = production.pen;
      mortalityRecord.numberDead = numberDead;
      mortalityRecord.cause = "Production mortality";
      mortalityRecord.date = production.date;
      mortalityRecord.notes = `Automatically generated from Production record ${production._id}`;

      await mortalityRecord.save({ session });

      await syncMortalityPopulation({
        allocationId: allocation._id,
        quantity: numberDead,
        eventDate: production.date,
        operation: "CORRECTION",
        sourceType: "PRODUCTION",
        sourceId: mortalityRecord._id,
        req,
        session,
        remarks: `Production mortality correction for ${production.pen}`,
      });
    } else {
      const created = await Mortality.create(
        [
          {
            flock: allocation.flock,
            allocation: allocation._id,
            productionRecord: production._id,
            birdBatch: production.pen,
            numberDead,
            cause: "Production mortality",
            date: production.date,
            notes: `Automatically generated from Production record ${production._id}`,
          },
        ],
        { session },
      );

      mortalityRecord = created[0];

      await syncMortalityPopulation({
        allocationId: allocation._id,
        quantity: numberDead,
        eventDate: production.date,
        operation: "NEW",
        sourceType: "PRODUCTION",
        sourceId: mortalityRecord._id,
        req,
        session,
        remarks: `Production mortality deduction for ${production.pen}`,
      });
    }

    retainedIds.add(String(mortalityRecord._id));
    healthSyncRecords.push(mortalityRecord);
  }

  // Reverse and remove mortality records whose allocations were removed
  // from the production breakdown.
  for (const [allocationId, oldRecord] of existingByAllocation.entries()) {
    if (retainedIds.has(String(oldRecord._id))) {
      continue;
    }

    await reverseMortalityPopulation({
      allocationId,
      eventDate: production.date,
      sourceType: "PRODUCTION",
      sourceId: oldRecord._id,
      req,
      session,
      remarks: `Production mortality allocation removed from ${production.pen}`,
    });

    healthDeleteRecords.push(oldRecord);

    await Mortality.findByIdAndDelete(oldRecord._id).session(session);
  }

  // Remove obsolete legacy mortality records only after confirming
  // that they have no population history.
  for (const oldRecord of existingMortalityRecords) {
    if (oldRecord.allocation) continue;

    await validateLegacyMortalityHasNoPopulationHistory(oldRecord, session);

    healthDeleteRecords.push(oldRecord);

    await Mortality.findByIdAndDelete(oldRecord._id).session(session);
  }

  production.mortalityRecord =
    healthSyncRecords.length > 0 ? healthSyncRecords[0]._id : null;

  await production.save({ session });

  return {
    healthSyncRecords,
    healthDeleteRecords,
  };
};

// ------------------------------------------------------------
// POST-TRANSACTION BIRD HEALTH SYNCHRONISATION
// ------------------------------------------------------------

const syncProductionBirdHealthAfterCommit = async ({
  healthSyncRecords = [],
  healthDeleteRecords = [],
  req,
}) => {
  for (const mortality of healthSyncRecords) {
    try {
      await syncLinkedBirdHealth({
        sourceRecord: mortality,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        payload: buildMortalityHealthPayload(mortality),
        req,
      });
    } catch (error) {
      console.error(
        `Production BirdHealth sync failed for mortality ${mortality._id}:`,
        error,
      );
    }
  }

  for (const mortality of healthDeleteRecords) {
    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: mortality,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        req,
      });
    } catch (error) {
      console.error(
        `Production BirdHealth cleanup failed for mortality ${mortality._id}:`,
        error,
      );
    }
  }
};

// ------------------------------------------------------------
// POPULATE PRODUCTION
// ------------------------------------------------------------

const populateProduction = (query) =>
  query.populate(
    "flock",
    "flockId pen placementDate startingAgeWeeks status saleDate",
  );

// ------------------------------------------------------------
// ALLOWED PRODUCTION FIELDS
// ------------------------------------------------------------

const ALLOWED_PRODUCTION_FIELDS = [
  "date",
  "pen",
  "days",
  "openingStock",
  "transferIn",
  "transferOut",
  "mortality",
  "mortalityAllocations",
  "sickBirds",
  "feedBagsConsumed",
  "waterConsumed",
  "drugsUsed",
  "cratesProduced",
  "extraEggPieces",
  "miscarriageProduction",
  "crackedEggs",
  "remarks",
];

const pickProductionFields = (body) => {
  const result = {};

  for (const field of ALLOWED_PRODUCTION_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      result[field] = body[field];
    }
  }

  return result;
};

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
  const session = await mongoose.startSession();

  let productionId;
  let healthSyncRecords = [];
  let healthDeleteRecords = [];

  try {
    await session.withTransaction(async () => {
      const productionData = pickProductionFields(req.body);

      const { pen, date } = productionData;
      const productionDate = getDayDate(date);

      if (!pen || !productionDate) {
        throw new Error("A valid production date and pen are required.");
      }

      const previous = await getPreviousProduction(
        pen,
        productionDate,
        null,
        session,
      );

      const flockData = await getProductionFlockData(
        pen,
        productionDate,
        session,
      );

      productionData.date = productionDate;
      productionData.pen = pen;
      productionData.flock = flockData.flock;
      productionData.flockId = flockData.flockId;
      productionData.flockAgeWeeks = flockData.flockAgeWeeks;

      productionData.openingStock =
        previous !== null
          ? Number(previous.closingStock)
          : Number(productionData.openingStock || 0);

      if (flockData.days !== null) {
        productionData.days = flockData.days;
      }

      const totals = calculateProductionTotals(productionData);

      if (totals.closingStock < 0) {
        throw new Error(
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
        );
      }

      Object.assign(productionData, totals);

      const production = new Production(productionData);

      await production.save({ session });

      const syncResult = await syncProductionMortality({
        production,
        req,
        session,
      });

      productionId = production._id;
      healthSyncRecords = syncResult.healthSyncRecords;
      healthDeleteRecords = syncResult.healthDeleteRecords;

      await recalculateRecordsAfter(
        production.pen,
        production.date,
        production.closingStock,
        session,
      );
    });

    await syncProductionBirdHealthAfterCommit({
      healthSyncRecords,
      healthDeleteRecords,
      req,
    });

    const production = await Production.findById(productionId);

    await logAudit(req, {
      action: "CREATE",
      module: "Production",
      description: `Created production record for ${production.pen}`,
      entityId: production._id,
      entityName: `${production.pen} - ${production.date.toISOString().slice(0, 10)}`,
      before: null,
      after: getProductionAuditSnapshot(production),
      metadata: {
        flockId: production.flockId || null,
        mortalityAllocations: production.mortalityAllocations,
      },
    });

    const result = await populateProduction(Production.findById(productionId));

    res.status(201).json(result);
  } catch (err) {
    console.error("CREATE PRODUCTION ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    res.status(400).json({ message: err.message });
  } finally {
    await session.endSession();
  }
};

// ------------------------------------------------------------
// UPDATE PRODUCTION
// ------------------------------------------------------------

exports.updateProduction = async (req, res) => {
  const session = await mongoose.startSession();

  let productionId;
  let beforeAudit;
  let afterAudit;
  let oldPen;
  let oldDate;
  let newPen;
  let newDate;
  let healthSyncRecords = [];
  let healthDeleteRecords = [];

  try {
    await session.withTransaction(async () => {
      const production = await Production.findById(req.params.id).session(
        session,
      );

      if (!production) {
        const error = new Error("Production record not found");
        error.statusCode = 404;
        throw error;
      }

      if (req.user.role !== "superadmin" && production.isDeleted) {
        const error = new Error("Production record not found");
        error.statusCode = 404;
        throw error;
      }

      oldPen = production.pen;
      oldDate = new Date(production.date);

      beforeAudit = getProductionAuditSnapshot(production);

      const updates = pickProductionFields(req.body);

      for (const [key, value] of Object.entries(updates)) {
        production[key] = value;
      }

      const productionDate = getDayDate(production.date);

      if (!production.pen || !productionDate) {
        throw new Error("A valid production date and pen are required.");
      }

      production.date = productionDate;

      const flockData = await getProductionFlockData(
        production.pen,
        production.date,
        session,
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
        session,
      );

      if (previous) {
        production.openingStock = Number(previous.closingStock);
      }

      const totals = calculateProductionTotals(production);

      if (totals.closingStock < 0) {
        throw new Error(
          "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
        );
      }

      Object.assign(production, totals);

      await production.save({ session });

      const syncResult = await syncProductionMortality({
        production,
        req,
        session,
      });

      healthSyncRecords = syncResult.healthSyncRecords;
      healthDeleteRecords = syncResult.healthDeleteRecords;

      newPen = production.pen;
      newDate = new Date(production.date);
      productionId = production._id;

      const oldDay = toUtcDay(oldDate);
      const newDay = toUtcDay(newDate);

      if (oldPen !== newPen || oldDay !== newDay) {
        await recalculatePenFromDate(oldPen, oldDate, session);
      }

      await recalculateRecordsAfter(
        newPen,
        newDate,
        production.closingStock,
        session,
      );

      afterAudit = getProductionAuditSnapshot(production);
    });

    await syncProductionBirdHealthAfterCommit({
      healthSyncRecords,
      healthDeleteRecords,
      req,
    });

    await logAudit(req, {
      action: "UPDATE",
      module: "Production",
      description: `Updated production record for ${newPen}`,
      entityId: productionId,
      entityName: `${newPen} - ${newDate.toISOString().slice(0, 10)}`,
      before: beforeAudit,
      after: afterAudit,
      metadata: {
        previousPen: oldPen,
        currentPen: newPen,
      },
    });

    const result = await populateProduction(Production.findById(productionId));

    res.json(result);
  } catch (err) {
    console.error("UPDATE PRODUCTION ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "A production entry already exists for that pen on that date.",
      });
    }

    res.status(err.statusCode || 400).json({
      message: err.message,
    });
  } finally {
    await session.endSession();
  }
};

// ------------------------------------------------------------
// DELETE PRODUCTION
// ------------------------------------------------------------

exports.deleteProduction = async (req, res) => {
  const session = await mongoose.startSession();

  let productionId;
  let affectedPen;
  let affectedDate;
  let beforeAudit;
  let permanentlyDeleted;
  let healthDeleteRecords = [];

  try {
    await session.withTransaction(async () => {
      const production = await Production.findById(req.params.id).session(
        session,
      );

      if (!production) {
        const error = new Error("Production record not found");
        error.statusCode = 404;
        throw error;
      }

      affectedPen = production.pen;
      affectedDate = new Date(production.date);

      beforeAudit = getProductionAuditSnapshot(production);

      const mortalityRecords = await Mortality.find({
        productionRecord: production._id,
      }).session(session);

      for (const mortality of mortalityRecords) {
        if (mortality.allocation) {
          await reverseMortalityPopulation({
            allocationId: mortality.allocation,
            eventDate: production.date,
            sourceType: "PRODUCTION",
            sourceId: mortality._id,
            req,
            session,
            remarks: `Production record deleted for ${production.pen}`,
          });
        } else {
          await validateLegacyMortalityHasNoPopulationHistory(
            mortality,
            session,
          );
        }

        healthDeleteRecords.push(mortality);

        await Mortality.findByIdAndDelete(mortality._id).session(session);
      }

      permanentlyDeleted = req.user.role === "superadmin";

      if (permanentlyDeleted) {
        await Production.findByIdAndDelete(production._id).session(session);
      } else {
        production.isDeleted = true;
        production.deletedBy = {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role,
        };
        production.deletedAt = new Date();
        production.mortalityRecord = null;
        production.mortalityAllocations = [];

        await production.save({ session });
      }

      await recalculatePenFromDate(affectedPen, affectedDate, session);

      productionId = production._id;
    });

    await syncProductionBirdHealthAfterCommit({
      healthDeleteRecords,
      req,
    });

    await logAudit(req, {
      action: "DELETE",
      module: "Production",
      description: permanentlyDeleted
        ? `Permanently deleted production record for ${affectedPen}`
        : `Soft-deleted production record for ${affectedPen}`,
      entityId: productionId,
      entityName: `${affectedPen} - ${affectedDate.toISOString().slice(0, 10)}`,
      before: beforeAudit,
      after: permanentlyDeleted
        ? null
        : {
            ...beforeAudit,
            isDeleted: true,
            mortalityAllocations: [],
          },
      metadata: {
        deletionType: permanentlyDeleted ? "permanent" : "soft",
      },
    });

    res.json({
      message: "Production deleted successfully",
    });
  } catch (err) {
    console.error("DELETE PRODUCTION ERROR:", err);

    res.status(err.statusCode || 400).json({
      message: err.message,
    });
  } finally {
    await session.endSession();
  }
};
