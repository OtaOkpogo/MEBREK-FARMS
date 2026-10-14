const Medication = require("../models/Medication");
const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
  restoreLinkedBirdHealth,
} = require("../services/healthSyncService");

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

    res.status(201).json(medication);
  } catch (err) {
    console.error("Create Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

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

    const fields = [
      "medicationName",
      "dosage",
      "purpose",
      "administeredTo",
      "dateAdministered",
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        medication[field] = req.body[field];
      }
    }

    if (!medication.medicationName?.trim()) {
      return res.status(400).json({
        message: "Medication name is required",
      });
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

    res.json(medication);
  } catch (err) {
    console.error("Update Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

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

    medication.isDeleted = true;
    medication.deletedAt = new Date();
    medication.deletedBy = req.user?.id || null;

    await medication.save({ validateModifiedOnly: true });

    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        req,
      });
    } catch (syncError) {
      console.error("Medication deletion sync error:", syncError);
    }

    res.json({ message: "Medication record deleted" });
  } catch (err) {
    console.error("Delete Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

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

    medication.isDeleted = false;
    medication.deletedAt = null;
    medication.deletedBy = null;

    await medication.save({ validateModifiedOnly: true });

    try {
      await restoreLinkedBirdHealth({
        sourceRecord: medication,
        sourceLinkField: "birdHealthRecord",
        req,
      });
    } catch (syncError) {
      console.error("Medication restore sync error:", syncError);
    }

    res.json(medication);
  } catch (err) {
    console.error("Restore Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};
