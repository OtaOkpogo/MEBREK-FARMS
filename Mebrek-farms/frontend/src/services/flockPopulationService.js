
const mongoose = require("mongoose");

const FlockAllocation = require("../models/FlockAllocation");
const FlockPopulationHistory = require("../models/FlockPopulationHistory");

const VALID_SOURCE_TYPES = ["MORTALITY", "PRODUCTION"];

const getUserId = (req) =>
  req?.user?.id || req?.user?._id || null;

const isWholeNumber = (value) =>
  Number.isInteger(Number(value)) && Number(value) >= 0;

const parseEventDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid mortality event date is required.");
  }

  return date;
};

// ------------------------------------------------------------
// VALIDATION
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
    throw new Error(
      "Invalid mortality population source type.",
    );
  }

  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new Error(
      "A valid mortality population source ID is required.",
    );
  }
};

// ------------------------------------------------------------
// ALLOCATION VALIDATION
// ------------------------------------------------------------

const getAllocation = async (allocationId, session) => {
  if (!mongoose.Types.ObjectId.isValid(allocationId)) {
    throw new Error("A valid flock allocation ID is required.");
  }

  const allocation = await FlockAllocation.findById(allocationId)
    .session(session);

  if (!allocation) {
    throw new Error("Flock allocation not found.");
  }

  if (allocation.status !== "ACTIVE") {
    throw new Error(
      "Mortality cannot be recorded against a closed flock allocation.",
    );
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

const validateAllocationEventDate = async (
  allocation,
  eventDate,
  session,
) => {
  if (eventDate < new Date(allocation.allocationDate)) {
    throw new Error(
      "The mortality date cannot be earlier than the flock allocation date.",
    );
  }

  const latestHistory = await FlockPopulationHistory.findOne({
    allocation: allocation._id,
    eventDate: { $exists: true },
  })
    .sort({ eventDate: -1, createdAt: -1 })
    .session(session);

  if (
    latestHistory &&
    eventDate < new Date(latestHistory.eventDate)
  ) {
    throw new Error(
      "This mortality date is earlier than the latest population history event for this allocation. Record the event in chronological order.",
    );
  }
};

// ------------------------------------------------------------
// EXISTING MORTALITY ACCOUNTING
// ------------------------------------------------------------

// A mortality source may have:
// - One original MORTALITY deduction.
// - One or more ADJUSTMENT entries when the quantity changes.
// - A positive ADJUSTMENT entry when the mortality is reversed.
//
// Adding all quantityChange values gives the net population change.
// A negative result represents the number of birds deducted.

const getExistingMortalityChange = async (
  allocationId,
  sourceType,
  sourceId,
  session,
) => {
  const entries = await FlockPopulationHistory.find({
    allocation: allocationId,
    sourceType,
    sourceId,
    eventType: { $in: ["MORTALITY", "ADJUSTMENT"] },
    quantityChange: { $ne: null },
  }).session(session);

  return entries.reduce(
    (total, entry) => total + Number(entry.quantityChange || 0),
    0,
  );
};

// ------------------------------------------------------------
// APPLY OR ADJUST MORTALITY
// ------------------------------------------------------------

/**
 * Synchronises the population deduction for a mortality source.
 *
 * quantity:
 *   The total number of deaths that should currently be attributed
 *   to this source. Use 0 to reverse the original deduction.
 *
 * allocationId:
 *   The exact FlockAllocation affected by the mortality.
 *
 * sourceType:
 *   MORTALITY for manually entered mortality.
 *   PRODUCTION for production-linked mortality.
 *
 * sourceId:
 *   The ID of the source record. Use the same ID every time this
 *   mortality record is updated or reversed.
 *
 * IMPORTANT:
 *   The caller must start and manage the MongoDB transaction.
 */
const syncMortalityPopulation = async ({
  allocationId,
  quantity,
  eventDate,
  sourceType,
  sourceId,
  req,
  session,
  remarks = "",
}) => {
  validateTransaction(session);
  validateSource({ sourceType, sourceId });

  if (!isWholeNumber(quantity)) {
    throw new Error(
      "Mortality quantity must be a non-negative whole number.",
    );
  }

  const targetQuantity = Number(quantity);
  const mortalityDate = parseEventDate(eventDate);

  const allocation = await getAllocation(
    allocationId,
    session,
  );

  await validateAllocationEventDate(
    allocation,
    mortalityDate,
    session,
  );

  const previousNetChange = await getExistingMortalityChange(
    allocation._id,
    sourceType,
    sourceId,
    session,
  );

  const previouslyDeducted = -previousNetChange;

  if (previouslyDeducted < 0) {
    throw new Error(
      "The existing mortality population history is inconsistent. Review its history before continuing.",
    );
  }

  // Positive delta means additional deaths.
  // Negative delta means some previously recorded deaths are being reversed.
  const quantityDifference =
    targetQuantity - previouslyDeducted;

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

  const newBalance =
    Number(allocation.currentBirds) - quantityDifference;

  if (newBalance < 0) {
    throw new Error(
      `Insufficient birds in ${allocation.pen}. Current population: ${allocation.currentBirds}; additional mortality: ${quantityDifference}.`,
    );
  }

  if (!Number.isInteger(newBalance)) {
    throw new Error(
      "The resulting flock population must be a whole number.",
    );
  }

  allocation.currentBirds = newBalance;
  allocation.updatedBy = getUserId(req);

  await allocation.save({ session });

  const isFirstDeduction =
    previouslyDeducted === 0 &&
    quantityDifference > 0 &&
    previousNetChange === 0;

  const historyEntry = {
    flock: allocation.flock,
    allocation: allocation._id,
    pen: allocation.pen,
    eventType: isFirstDeduction ? "MORTALITY" : "ADJUSTMENT",
    quantityChange: -quantityDifference,
    balanceAfter: newBalance,
    eventDate: mortalityDate,
    sourceType,
    sourceId,
    remarks:
      remarks ||
      (quantityDifference > 0
        ? `Mortality population deduction: ${quantityDifference} bird(s).`
        : `Mortality population reversal: ${Math.abs(quantityDifference)} bird(s) restored.`),
    createdBy: getUserId(req),
  };

  await FlockPopulationHistory.create(
    [historyEntry],
    { session },
  );

  return {
    changed: true,
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

/**
 * Reverses all population deductions attributed to a mortality source.
 *
 * This does not delete previous history entries. It creates a
 * compensating ADJUSTMENT entry through syncMortalityPopulation().
 */
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

