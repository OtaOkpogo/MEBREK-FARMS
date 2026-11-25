const mongoose = require("mongoose");

const FlockAllocation = require("../models/FlockAllocation");
const FlockPopulationHistory = require("../models/FlockPopulationHistory");

const VALID_SOURCE_TYPES = ["MORTALITY", "PRODUCTION"];

const getUserId = (req) => req?.user?.id || req?.user?._id || null;

const isWholeNumber = (value) =>
  Number.isInteger(Number(value)) && Number(value) >= 0;

const parseEventDate = (value, label = "date") => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`A valid ${label} is required.`);
  }

  return date;
};

// ------------------------------------------------------------
// TRANSACTION VALIDATION
// ------------------------------------------------------------

const validateTransaction = (session) => {
  if (!session || !session.inTransaction()) {
    throw new Error(
      "Mortality population changes must run inside a MongoDB transaction.",
    );
  }
};

const validateSource = ({ sourceType, sourceId }) => {
  if (!VALID_SOURCE_TYPES.includes(sourceType)) {
    throw new Error("Invalid mortality population source type.");
  }

  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new Error("A valid mortality population source ID is required.");
  }
};

// ------------------------------------------------------------
// ALLOCATION VALIDATION
// ------------------------------------------------------------

const getAllocation = async (
  allocationId,
  session,
  { allowClosed = false } = {},
) => {
  if (!mongoose.Types.ObjectId.isValid(allocationId)) {
    throw new Error("A valid flock allocation ID is required.");
  }

  const allocation =
    await FlockAllocation.findById(allocationId).session(session);

  if (!allocation) {
    throw new Error("Flock allocation not found.");
  }

  if (!allowClosed && allocation.status !== "ACTIVE") {
    throw new Error(
      "This flock allocation is closed. New mortality deductions cannot be recorded against it.",
    );
  }

  if (allocation.status !== "ACTIVE" && allocation.status !== "CLOSED") {
    throw new Error("Invalid flock allocation status.");
  }

  if (allocation.currentBirds === null) {
    throw new Error(
      "This flock allocation has an unknown population. Establish its population before recording mortality.",
    );
  }

  return allocation;
};

// ------------------------------------------------------------
// CHRONOLOGICAL VALIDATION
// ------------------------------------------------------------

const validateAllocationEventDate = async (allocation, eventDate, session) => {
  if (eventDate < new Date(allocation.allocationDate)) {
    throw new Error(
      "The population event date cannot be earlier than the allocation date.",
    );
  }

  const latestHistory = await FlockPopulationHistory.findOne({
    allocation: allocation._id,
    eventDate: { $exists: true },
  })
    .sort({ eventDate: -1, createdAt: -1 })
    .session(session);

  if (latestHistory && eventDate < new Date(latestHistory.eventDate)) {
    throw new Error(
      "This population event is earlier than the latest history event for this allocation. Record events in chronological order.",
    );
  }
};

// ------------------------------------------------------------
// EXISTING MORTALITY ACCOUNTING
// ------------------------------------------------------------

const getExistingMortalityEntries = async (
  allocationId,
  sourceType,
  sourceId,
  session,
) => {
  return FlockPopulationHistory.find({
    allocation: allocationId,
    sourceType,
    sourceId,
    eventType: { $in: ["MORTALITY", "ADJUSTMENT"] },
    quantityChange: { $ne: null },
  })
    .sort({ eventDate: 1, createdAt: 1 })
    .session(session);
};

const getExistingMortalityChange = (entries) => {
  return entries.reduce(
    (total, entry) => total + Number(entry.quantityChange || 0),
    0,
  );
};

// ------------------------------------------------------------
// CLOSED ALLOCATION SAFETY
// ------------------------------------------------------------

const validateClosedAllocationCorrection = async ({
  allocation,
  sourceType,
  sourceId,
  sourceEntries,
  session,
}) => {
  if (allocation.status !== "CLOSED") {
    return;
  }

  if (!sourceEntries.length) {
    throw new Error(
      "A closed allocation can only be corrected or reversed when an existing mortality population deduction is present.",
    );
  }

  const latestSourceEntry = sourceEntries[sourceEntries.length - 1];

  const laterHistory = await FlockPopulationHistory.findOne({
    allocation: allocation._id,
    eventDate: {
      $gt: latestSourceEntry.eventDate,
    },
    $nor: [
      {
        sourceType,
        sourceId,
      },
    ],
  }).session(session);

  if (laterHistory) {
    throw new Error(
      "This allocation has subsequent population events. Its historical mortality cannot be corrected or reversed automatically because doing so could invalidate later transfers or population changes. Reconcile the later population events first.",
    );
  }
};

// ------------------------------------------------------------
// APPLY OR ADJUST MORTALITY
// ------------------------------------------------------------

/**
 * Applies or synchronises mortality population accounting.
 *
 * operation:
 *   NEW        - records a new mortality deduction.
 *   CORRECTION - adjusts an existing mortality deduction.
 *   REVERSAL   - restores a previously deducted population.
 *
 * NEW operations require an ACTIVE allocation.
 *
 * CORRECTION and REVERSAL may operate on CLOSED allocations
 * only when existing history proves the correction is safe.
 *
 * The caller must manage the MongoDB transaction.
 */
const syncMortalityPopulation = async ({
  allocationId,
  quantity,
  eventDate,
  operation = "NEW",
  sourceType,
  sourceId,
  req,
  session,
  remarks = "",
}) => {
  validateTransaction(session);
  validateSource({ sourceType, sourceId });

  if (!isWholeNumber(quantity)) {
    throw new Error("Mortality quantity must be a non-negative whole number.");
  }

  if (!["NEW", "CORRECTION", "REVERSAL"].includes(operation)) {
    throw new Error("Invalid mortality accounting operation.");
  }

  const targetQuantity = Number(quantity);

  const mortalityDate = parseEventDate(eventDate, "mortality event date");

  const accountingDate = operation === "NEW" ? mortalityDate : new Date();

  const allocation = await getAllocation(allocationId, session, {
    allowClosed: operation !== "NEW",
  });

  const sourceEntries = await getExistingMortalityEntries(
    allocation._id,
    sourceType,
    sourceId,
    session,
  );

  const previousNetChange = getExistingMortalityChange(sourceEntries);

  const previouslyDeducted = -previousNetChange;

  if (!Number.isInteger(previouslyDeducted) || previouslyDeducted < 0) {
    throw new Error(
      "Existing mortality population history is inconsistent. Review it before continuing.",
    );
  }

  if (operation === "NEW" && previouslyDeducted !== 0) {
    throw new Error(
      "This mortality source already has population history. Use a correction operation instead.",
    );
  }

  if (operation === "REVERSAL" && targetQuantity !== 0) {
    throw new Error(
      "A mortality reversal must have a target quantity of zero.",
    );
  }

  if (allocation.status === "CLOSED" && previouslyDeducted <= 0) {
    throw new Error(
      "A closed allocation requires an existing population deduction before it can be corrected or reversed.",
    );
  }

  if (allocation.status === "CLOSED") {
    await validateClosedAllocationCorrection({
      allocation,
      sourceType,
      sourceId,
      sourceEntries,
      session,
    });
  }

  await validateAllocationEventDate(allocation, accountingDate, session);

  const quantityDifference = targetQuantity - previouslyDeducted;

  if (quantityDifference === 0) {
    return {
      changed: false,
      allocationId: allocation._id,
      flockId: allocation.flock,
      pen: allocation.pen,
      previousMortality: previouslyDeducted,
      currentMortality: targetQuantity,
      currentBirds: allocation.currentBirds,
    };
  }

  const newBalance = Number(allocation.currentBirds) - quantityDifference;

  if (newBalance < 0) {
    throw new Error(
      `Insufficient birds in ${allocation.pen}. Current population: ${allocation.currentBirds}; additional mortality: ${quantityDifference}.`,
    );
  }

  if (!Number.isInteger(newBalance)) {
    throw new Error("The resulting flock population must be a whole number.");
  }

  allocation.currentBirds = newBalance;

  const userId = getUserId(req);

  if (userId) {
    allocation.updatedBy = userId;
  }

  await allocation.save({ session });

  const isInitialDeduction =
    operation === "NEW" && quantityDifference > 0 && previousNetChange === 0;

  const eventType = isInitialDeduction ? "MORTALITY" : "ADJUSTMENT";

  const defaultRemarks =
    operation === "REVERSAL"
      ? `Mortality reversed. Restored ${Math.abs(quantityDifference)} bird(s).`
      : quantityDifference > 0
        ? `Mortality population deduction: ${quantityDifference} bird(s).`
        : `Mortality correction: restored ${Math.abs(quantityDifference)} bird(s).`;

  const historyEntry = {
    flock: allocation.flock,
    allocation: allocation._id,
    pen: allocation.pen,
    eventType,
    quantityChange: -quantityDifference,
    balanceAfter: newBalance,
    eventDate: accountingDate,
    sourceType,
    sourceId,
    remarks: remarks || defaultRemarks,
    createdBy: userId,
  };

  await FlockPopulationHistory.create([historyEntry], { session });

  return {
    changed: true,
    operation,
    allocationId: allocation._id,
    flockId: allocation.flock,
    pen: allocation.pen,
    previousMortality: previouslyDeducted,
    currentMortality: targetQuantity,
    quantityDifference,
    currentBirds: newBalance,
  };
};

// ------------------------------------------------------------
// REVERSE MORTALITY
// ------------------------------------------------------------

const reverseMortalityPopulation = async ({
  allocationId,
  eventDate,
  sourceType,
  sourceId,
  req,
  session,
  remarks = "",
}) => {
  return syncMortalityPopulation({
    allocationId,
    quantity: 0,
    eventDate,
    operation: "REVERSAL",
    sourceType,
    sourceId,
    req,
    session,
    remarks:
      remarks || "Mortality record reversed; birds restored to population.",
  });
};

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

module.exports = {
  syncMortalityPopulation,
  reverseMortalityPopulation,
};
