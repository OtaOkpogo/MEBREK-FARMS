const Medication = require("../models/Medication");
const { logAudit } = require("../utils/auditLogger");

const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
  restoreLinkedBirdHealth,
} = require("../services/healthSyncService");

// ============================================================
// HELPERS
// ============================================================

const buildHealthPayload = (medication) => {
  const actionTaken = [medication.purpose, medication.dosage]
    .filter(Boolean)
    .join(" — ");

  return {
    date: medication.dateAdministered || new Date(),
    pen: medication.administeredTo,
    healthIssue: medication.medicationName,
    category: "Medication",
    symptoms: "Medication administered",
    diagnosis: medication.purpose || "Treatment",
    medicationUsed: medication.medicationName,
    actionTaken: actionTaken || "Medication administered",
    birdsAffected: 1,
    severity: "Low",
    status: "Recovering",
    remarks: medication.purpose || "",
  };
};

// Snapshot only relevant medication information.
const getMedicationAuditSnapshot = (medication) => {
  if (!medication) return null;

  const data = medication.toObject ? medication.toObject() : medication;

  return {
    medicationName: data.medicationName,
    dosage: data.dosage,
    purpose: data.purpose,
    administeredTo: data.administeredTo,
    dateAdministered: data.dateAdministered,
    administeredBy: data.administeredBy?._id || data.administeredBy || null,
    isDeleted: data.isDeleted,
    deletedAt: data.deletedAt,
  };
};

const UPDATABLE_FIELDS = [
  "medicationName",
  "dosage",
  "purpose",
  "administeredTo",
  "dateAdministered",
];

// ============================================================
// GET MEDICATIONS
// ============================================================

exports.getMedications = async (req, res) => {
  try {
    const filter = req.user?.role === "superadmin" ? {} : { isDeleted: false };

    const medications = await Medication.find(filter)
      .sort({ dateAdministered: -1 })
      .populate("administeredBy", "name email")
      .populate("deletedBy", "role name")
      .populate("birdHealthRecord");

    res.json(medications);
  } catch (err) {
    console.error("Get Medications Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// CREATE MEDICATION
// ============================================================

exports.createMedication = async (req, res) => {
  try {
    const {
      medicationName,
      dosage,
      purpose,
      administeredTo,
      dateAdministered,
    } = req.body;

    if (!medicationName || !medicationName.trim()) {
      return res.status(400).json({
        message: "Medication name is required",
      });
    }

    const medication = await Medication.create({
      medicationName,
      dosage,
      purpose,
      administeredTo,
      dateAdministered: dateAdministered || Date.now(),
      administeredBy: req.user?.id,
    });

    try {
      await syncLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "medicationRecord",
        payload: buildHealthPayload(medication),
        req,
      });
    } catch (syncError) {
      console.error("Medication → Bird Health sync error:", syncError);
    }

    await logAudit(req, {
      action: "CREATE",
      module: "Medications",
      description: `Recorded administration of ${medication.medicationName} to ${medication.administeredTo || "unspecified pen"}`,
      entityId: medication._id,
      entityName: medication.medicationName,
      after: getMedicationAuditSnapshot(medication),
    });

    res.status(201).json(medication);
  } catch (err) {
    console.error("Create Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// UPDATE MEDICATION
// ============================================================

exports.updateMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!medication) {
      return res.status(404).json({
        message: "Medication record not found",
      });
    }

    const before = getMedicationAuditSnapshot(medication);
    const changedFields = [];

    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        const oldValue = medication[field];
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
          medication[field] = newValue;
        }
      }
    }

    if (!medication.medicationName?.trim()) {
      return res.status(400).json({
        message: "Medication name is required",
      });
    }

    if (changedFields.length === 0) {
      return res.json(medication);
    }

    await medication.save();

    try {
      await syncLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "medicationRecord",
        payload: buildHealthPayload(medication),
        req,
      });
    } catch (syncError) {
      console.error("Medication → Bird Health sync error:", syncError);
    }

    await logAudit(req, {
      action: "UPDATE",
      module: "Medications",
      description: `Updated medication record: ${medication.medicationName}`,
      entityId: medication._id,
      entityName: medication.medicationName,
      before,
      after: getMedicationAuditSnapshot(medication),
      metadata: {
        changedFields,
      },
    });

    res.json(medication);
  } catch (err) {
    console.error("Update Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// DELETE MEDICATION (SOFT DELETE)
// ============================================================

exports.deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!medication) {
      return res.status(404).json({
        message: "Medication record not found",
      });
    }

    const before = getMedicationAuditSnapshot(medication);

    medication.isDeleted = true;
    medication.deletedAt = new Date();
    medication.deletedBy = req.user?.id || null;

    await medication.save({ validateModifiedOnly: true });

    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "medicationRecord",
        req,
      });
    } catch (syncError) {
      console.error("Medication deletion sync error:", syncError);
    }

    await logAudit(req, {
      action: "DELETE",
      module: "Medications",
      description: `Deleted medication record: ${medication.medicationName}`,
      entityId: medication._id,
      entityName: medication.medicationName,
      before,
      after: getMedicationAuditSnapshot(medication),
      metadata: {
        deletedAt: medication.deletedAt,
      },
    });

    res.json({ message: "Medication record deleted" });
  } catch (err) {
    console.error("Delete Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// GET DELETED MEDICATIONS
// ============================================================

exports.getDeletedMedications = async (req, res) => {
  try {
    const medications = await Medication.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("administeredBy", "name email")
      .populate("deletedBy", "name email")
      .populate("birdHealthRecord");

    res.json(medications);
  } catch (err) {
    console.error("Get Deleted Medications Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ============================================================
// RESTORE MEDICATION
// ============================================================

exports.restoreMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!medication) {
      return res.status(404).json({
        message: "Deleted medication record not found",
      });
    }

    const before = getMedicationAuditSnapshot(medication);

    const previousDeletion = {
      deletedAt: medication.deletedAt,
      deletedBy: medication.deletedBy,
    };

    medication.isDeleted = false;
    medication.deletedAt = null;
    medication.deletedBy = null;

    await medication.save({ validateModifiedOnly: true });

    try {
      await restoreLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "medicationRecord",
        req,
      });
    } catch (syncError) {
      console.error("Medication restore sync error:", syncError);
    }

    await logAudit(req, {
      action: "RESTORE",
      module: "Medications",
      description: `Restored medication record: ${medication.medicationName}`,
      entityId: medication._id,
      entityName: medication.medicationName,
      before,
      after: getMedicationAuditSnapshot(medication),
      metadata: {
        previousDeletion,
      },
    });

    res.json(medication);
  } catch (err) {
    console.error("Restore Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};
