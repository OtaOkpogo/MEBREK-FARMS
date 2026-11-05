const Mortality = require("../models/Mortality");
const { logAudit } = require("../utils/auditLogger");

const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
} = require("../services/healthSyncService");

// ============================================================
// HELPERS
// ============================================================

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
    numberDead: data.numberDead,
    cause: data.cause,
    estimatedLoss: data.estimatedLoss,
    notes: data.notes,
    date: data.date,
    productionRecord: data.productionRecord || null,
    birdHealthRecord: data.birdHealthRecord || null,
  };
};

// ============================================================
// GET MORTALITY
// ============================================================

exports.getMortality = async (req, res) => {
  try {
    const records = await Mortality.find()
      .sort({ createdAt: -1 })
      .populate("productionRecord", "date pen mortality")
      .populate("birdHealthRecord");

    res.json(records);
  } catch (err) {
    console.error("GET MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE MORTALITY
// ============================================================

exports.createMortality = async (req, res) => {
  try {
    const record = await Mortality.create(req.body);

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
    console.error("CREATE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE MORTALITY
// ============================================================

exports.updateMortality = async (req, res) => {
  try {
    const record = await Mortality.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    if (record.productionRecord) {
      return res.status(409).json({
        message:
          "This mortality entry was generated from Production. Edit the production record instead.",
      });
    }

    const before = getMortalityAuditSnapshot(record);

    const allowedFields = [
      "birdBatch",
      "numberDead",
      "cause",
      "estimatedLoss",
      "notes",
      "date",
    ];

    const changedFields = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        const oldValue = record[field];

        const newValue = req.body[field];

        const oldComparable =
          oldValue instanceof Date
            ? oldValue.toISOString()
            : oldValue?.toString?.();

        const newComparable =
          oldValue instanceof Date
            ? new Date(newValue).toISOString()
            : newValue?.toString?.();

        if (oldComparable !== newComparable) {
          changedFields.push(field);
          record[field] = newValue;
        }
      }
    }

    if (changedFields.length === 0) {
      return res.json(record);
    }

    await record.save();

    try {
      await syncLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        payload: buildHealthPayload(record),
        req,
      });
    } catch (syncError) {
      console.error("Mortality update sync error:", syncError);
    }

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
    console.error("UPDATE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE MORTALITY
// ============================================================

exports.deleteMortality = async (req, res) => {
  try {
    const record = await Mortality.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    if (record.productionRecord) {
      return res.status(409).json({
        message:
          "This mortality entry was generated from Production. Delete the production record instead.",
      });
    }

    const before = getMortalityAuditSnapshot(record);

    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        req,
      });
    } catch (syncError) {
      console.error("Mortality deletion sync error:", syncError);

      return res.status(500).json({
        message:
          "Could not synchronize the linked Bird Health record. Mortality was not deleted.",
      });
    }

    await Mortality.findByIdAndDelete(record._id);

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
      },
    });

    res.json({
      message: "Mortality record deleted successfully",
    });
  } catch (err) {
    console.error("DELETE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
