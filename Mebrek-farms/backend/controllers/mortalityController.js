const mongoose = require("mongoose");

const Mortality = require("../models/Mortality");
const FlockAllocation = require("../models/FlockAllocation");

const { logAudit } = require("../utils/auditLogger");

const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
} = require("../services/healthSyncService");

const {
  syncMortalityPopulation,
  reverseMortalityPopulation,
} = require("../services/flockPopulationService");

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getErrorStatus = (err) => {
  if (err.statusCode) return err.statusCode;

  if (err.name === "ValidationError" || err.name === "CastError") {
    return 400;
  }

  return 500;
};

const buildHealthPayload = (record) => ({
  date: record.date || new Date(),
  pen: record.birdBatch,
  healthIssue: record.cause,
  category: "Mortality",
  symptoms: `${record.numberDead} bird(s) died`,
  diagnosis: record.cause,
  actionTaken: "Mortality recorded",
  birdsAffected: record.numberDead || 0,
  severity: "Critical",
  status: "Dead",
  remarks: record.notes || "",
});

const getMortalityAuditSnapshot = (record) => {
  if (!record) return null;

  const data = record.toObject ? record.toObject() : record;

  return {
    birdBatch: data.birdBatch,
    flock: data.flock || null,
    allocation: data.allocation || null,
    numberDead: data.numberDead,
    cause: data.cause,
    estimatedLoss: data.estimatedLoss,
    notes: data.notes,
    date: data.date,
    productionRecord: data.productionRecord || null,
    birdHealthRecord: data.birdHealthRecord || null,
  };
};

const syncBirdHealth = async (record, req) => {
  try {
    await syncLinkedBirdHealth({
      sourceRecord: record,
      sourceLinkField: "birdHealthRecord",
      healthLinkField: "mortalityRecord",
      payload: buildHealthPayload(record),
      req,
    });
  } catch (syncError) {
    console.error("Mortality → Bird Health sync error:", syncError);
  }
};

// ============================================================
// GET MORTALITY
// ============================================================

exports.getMortality = async (req, res) => {
  try {
    const records = await Mortality.find()
      .sort({ createdAt: -1 })
      .populate("productionRecord", "date pen mortality")
      .populate("birdHealthRecord")
      .populate("flock", "flockId pen status")
      .populate("allocation", "pen currentBirds status");

    res.json(records);
  } catch (err) {
    console.error("GET MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE MANUAL MORTALITY
// ============================================================

exports.createMortality = async (req, res) => {
  let session;

  try {
    const {
      birdBatch,
      allocation: allocationId,
      numberDead,
      cause,
      estimatedLoss,
      notes,
      date,
    } = req.body;

    if (!birdBatch || !allocationId || numberDead === undefined || !cause) {
      return res.status(400).json({
        message:
          "Pen, allocation, number of dead birds and cause are required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(allocationId)) {
      return res.status(400).json({
        message: "A valid flock allocation is required.",
      });
    }

    if (
      numberDead === "" ||
      !Number.isInteger(Number(numberDead)) ||
      Number(numberDead) < 0
    ) {
      return res.status(400).json({
        message: "Number of dead birds must be a non-negative whole number.",
      });
    }

    const mortalityDate = date ? new Date(date) : new Date();

    if (Number.isNaN(mortalityDate.getTime())) {
      return res.status(400).json({
        message: "A valid mortality date is required.",
      });
    }

    session = await mongoose.startSession();

    let record;

    await session.withTransaction(async () => {
      const allocation =
        await FlockAllocation.findById(allocationId).session(session);

      if (!allocation) {
        throw createError("The selected flock allocation was not found.", 404);
      }

      if (allocation.status !== "ACTIVE") {
        throw createError(
          "Mortality can only be recorded against an active flock allocation.",
          409,
        );
      }

      if (allocation.pen !== birdBatch) {
        throw createError(
          `The selected allocation belongs to ${allocation.pen}, not ${birdBatch}.`,
          400,
        );
      }

      if (
        allocation.currentBirds === null ||
        allocation.currentBirds === undefined
      ) {
        throw createError(
          "This allocation has unknown population. Establish its opening population before recording mortality.",
          409,
        );
      }

      record = new Mortality({
        birdBatch: allocation.pen,
        flock: allocation.flock,
        allocation: allocation._id,
        numberDead: Number(numberDead),
        cause,
        estimatedLoss: estimatedLoss ?? 0,
        notes: notes || "",
        date: mortalityDate,
      });

      await record.save({ session });

      await syncMortalityPopulation({
        allocationId: allocation._id,
        quantity: Number(numberDead),
        eventDate: mortalityDate,
        operation: "NEW",
        sourceType: "MORTALITY",
        sourceId: record._id,
        req,
        session,
        remarks: `Manual mortality: ${cause}`,
      });
    });

    await session.endSession();
    session = null;

    await syncBirdHealth(record, req);

    await logAudit(req, {
      action: "CREATE",
      module: "Mortality",
      description: `Recorded mortality of ${record.numberDead} bird(s) in ${record.birdBatch}`,
      entityId: record._id,
      entityName: `${record.birdBatch} - ${record.numberDead} deaths`,
      after: getMortalityAuditSnapshot(record),
    });

    res.status(201).json(record);
  } catch (err) {
    if (session) {
      await session.endSession().catch(() => {});
    }

    console.error("CREATE MORTALITY ERROR:", err);

    res.status(getErrorStatus(err)).json({
      message: err.message,
    });
  }
};

// ============================================================
// UPDATE MANUAL MORTALITY
// ============================================================

exports.updateMortality = async (req, res) => {
  let session;

  try {
    session = await mongoose.startSession();

    let record;
    let before;
    let changedFields = [];

    await session.withTransaction(async () => {
      record = await Mortality.findById(req.params.id).session(session);

      if (!record) {
        throw createError("Mortality record not found.", 404);
      }

      if (record.productionRecord) {
        throw createError(
          "This mortality entry was generated from Production. Edit the production record instead.",
          409,
        );
      }

      before = getMortalityAuditSnapshot(record);

      // Allocation changes require a separate population reconciliation.
      if (
        req.body.allocation !== undefined &&
        String(req.body.allocation) !== String(record.allocation || "")
      ) {
        throw createError(
          "The allocation of an existing mortality record cannot be changed. Create a properly allocated record instead.",
          409,
        );
      }

      if (
        req.body.flock !== undefined &&
        String(req.body.flock) !== String(record.flock || "")
      ) {
        throw createError(
          "The flock associated with an existing mortality record cannot be changed.",
          409,
        );
      }

      if (
        req.body.birdBatch !== undefined &&
        req.body.birdBatch !== record.birdBatch
      ) {
        throw createError(
          "The pen of an existing mortality record cannot be changed.",
          409,
        );
      }

      if (req.body.date !== undefined) {
        const requestedDate = new Date(req.body.date);

        if (
          Number.isNaN(requestedDate.getTime()) ||
          requestedDate.getTime() !== new Date(record.date).getTime()
        ) {
          throw createError(
            "The date of an existing mortality record cannot be changed because it is linked to population history.",
            409,
          );
        }
      }

      const allowedFields = ["numberDead", "cause", "estimatedLoss", "notes"];

      for (const field of allowedFields) {
        if (req.body[field] === undefined) continue;

        const oldValue = record[field];
        const newValue = req.body[field];

        if (String(oldValue ?? "") !== String(newValue ?? "")) {
          if (field === "numberDead") {
            if (
              newValue === "" ||
              !Number.isInteger(Number(newValue)) ||
              Number(newValue) < 0
            ) {
              throw createError(
                "Number of dead birds must be a non-negative whole number.",
                400,
              );
            }

            record[field] = Number(newValue);
          } else {
            record[field] = newValue;
          }

          changedFields.push(field);
        }
      }

      if (changedFields.length === 0) return;

      // Existing records without allocations are legacy records.
      // Do not guess which flock should receive their correction.
      if (changedFields.includes("numberDead") && !record.allocation) {
        throw createError(
          "This older mortality record has no linked flock allocation. Reconcile its allocation before changing the death count.",
          409,
        );
      }

      await record.save({ session });

      if (changedFields.includes("numberDead")) {
        await syncMortalityPopulation({
          allocationId: record.allocation,
          quantity: record.numberDead,
          eventDate: record.date,
          operation: "CORRECTION",
          sourceType: "MORTALITY",
          sourceId: record._id,
          req,
          session,
          remarks: "Mortality count correction",
        });
      }
    });

    await session.endSession();
    session = null;

    if (changedFields.length === 0) {
      return res.json(record);
    }

    await syncBirdHealth(record, req);

    await logAudit(req, {
      action: "UPDATE",
      module: "Mortality",
      description: `Updated mortality record for ${record.birdBatch}`,
      entityId: record._id,
      entityName: `${record.birdBatch} - ${record.numberDead} deaths`,
      before,
      after: getMortalityAuditSnapshot(record),
      metadata: {
        changedFields,
      },
    });

    res.json(record);
  } catch (err) {
    if (session) {
      await session.endSession().catch(() => {});
    }

    console.error("UPDATE MORTALITY ERROR:", err);

    res.status(getErrorStatus(err)).json({
      message: err.message,
    });
  }
};

// ============================================================
// DELETE MANUAL MORTALITY
// ============================================================

exports.deleteMortality = async (req, res) => {
  let session;

  try {
    session = await mongoose.startSession();

    let record;
    let before;

    await session.withTransaction(async () => {
      record = await Mortality.findById(req.params.id).session(session);

      if (!record) {
        throw createError("Mortality record not found.", 404);
      }

      if (record.productionRecord) {
        throw createError(
          "This mortality entry was generated from Production. Delete the production record instead.",
          409,
        );
      }

      before = getMortalityAuditSnapshot(record);

      // Reverse the original deduction before deleting the record.
      if (record.allocation) {
        await reverseMortalityPopulation({
          allocationId: record.allocation,
          eventDate: record.date,
          sourceType: "MORTALITY",
          sourceId: record._id,
          req,
          session,
          remarks: "Manual mortality record deleted",
        });
      }

      await record.deleteOne({ session });
    });

    await session.endSession();
    session = null;

    // BirdHealth synchronisation happens after the population
    // transaction has committed.
    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        req,
      });
    } catch (syncError) {
      console.error("Mortality deletion sync error:", syncError);
    }

    await logAudit(req, {
      action: "DELETE",
      module: "Mortality",
      description: `Deleted mortality record for ${record.birdBatch}`,
      entityId: record._id,
      entityName: `${record.birdBatch} - ${record.numberDead} deaths`,
      before,
      after: null,
      metadata: {
        deletionType: "PERMANENT",
        linkedBirdHealthRecord: record.birdHealthRecord || null,
        populationReversed: Boolean(record.allocation),
      },
    });

    res.json({
      message:
        "Mortality record deleted and population accounting updated successfully.",
    });
  } catch (err) {
    if (session) {
      await session.endSession().catch(() => {});
    }

    console.error("DELETE MORTALITY ERROR:", err);

    res.status(getErrorStatus(err)).json({
      message: err.message,
    });
  }
};
