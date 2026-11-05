const Vaccination = require("../models/Vaccination");
const { logAudit } = require("../utils/auditLogger");

const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
  restoreLinkedBirdHealth,
} = require("../services/healthSyncService");

// ============================================================
// HELPERS
// ============================================================

const calculateStatus = (nextDueDate) => {
  if (!nextDueDate) return "Completed";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return "Overdue";
  if (due.getTime() === today.getTime()) return "Due Today";

  return "Upcoming";
};

const buildHealthPayload = (vaccination) => ({
  date: vaccination.vaccinationDate || new Date(),
  pen: vaccination.pen,
  healthIssue: vaccination.vaccineName,
  category: "Vaccination",
  symptoms: "Preventive vaccination",
  diagnosis: vaccination.vaccineType || "Routine Vaccination",
  actionTaken: `Vaccination administered (${vaccination.route || "N/A"})`,
  birdsAffected: vaccination.birdsVaccinated || 0,
  medicationUsed: vaccination.vaccineName,
  veterinarianName: vaccination.administeredBy?.name || "Farm staff",
  followUpDate: vaccination.nextDueDate,
  followUpStatus: calculateStatus(vaccination.nextDueDate),
  status: "Recovered",
  remarks: vaccination.notes || "",
});

const emit = (req, event, record) => {
  const io = req.app.get("io");
  if (io) io.emit(event, record);
};

// Snapshot only relevant vaccination information.
// Keep deletion metadata separate in the audit metadata.
const getVaccinationAuditSnapshot = (vaccination) => {
  if (!vaccination) return null;

  const data = vaccination.toObject ? vaccination.toObject() : vaccination;

  return {
    pen: data.pen,
    vaccineName: data.vaccineName,
    vaccineType: data.vaccineType,
    batchNumber: data.batchNumber,
    manufacturer: data.manufacturer,
    quantityUsed: data.quantityUsed,
    unit: data.unit,
    birdsVaccinated: data.birdsVaccinated,
    vaccinationDate: data.vaccinationDate,
    nextDueDate: data.nextDueDate,
    route: data.route,
    cost: data.cost,
    notes: data.notes,
    status: calculateStatus(data.nextDueDate),
    isDeleted: data.isDeleted,
    administeredBy: data.administeredBy || null,
  };
};

const UPDATABLE_FIELDS = [
  "pen",
  "vaccineName",
  "vaccineType",
  "batchNumber",
  "manufacturer",
  "quantityUsed",
  "unit",
  "birdsVaccinated",
  "vaccinationDate",
  "nextDueDate",
  "route",
  "cost",
  "notes",
];

// ============================================================
// GET VACCINATIONS
// ============================================================

exports.getVaccinations = async (req, res) => {
  try {
    const filter = req.user?.role === "superadmin" ? {} : { isDeleted: false };

    const vaccinations = await Vaccination.find(filter)
      .sort({ vaccinationDate: -1 })
      .populate("birdHealthRecord");

    res.json(
      vaccinations.map((item) => {
        const obj = item.toObject();
        obj.status = calculateStatus(obj.nextDueDate);
        return obj;
      }),
    );
  } catch (err) {
    console.error("Get Vaccinations Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// CREATE VACCINATION
// ============================================================

exports.createVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.create({
      ...req.body,
      administeredBy: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role,
      },
      status: calculateStatus(req.body.nextDueDate),
    });

    emit(req, "newVaccination", vaccination);

    try {
      await syncLinkedBirdHealth({
        sourceRecord: vaccination,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "vaccinationRecord",
        payload: buildHealthPayload(vaccination),
        req,
      });
    } catch (syncError) {
      console.error("Vaccination → Bird Health sync error:", syncError);
    }

    await logAudit(req, {
      action: "CREATE",
      module: "Vaccinations",
      description: `Recorded ${vaccination.vaccineName} vaccination for ${vaccination.pen}`,
      entityId: vaccination._id,
      entityName: vaccination.vaccineName,
      after: getVaccinationAuditSnapshot(vaccination),
      metadata: {
        birdsVaccinated: vaccination.birdsVaccinated,
        quantityUsed: vaccination.quantityUsed,
        cost: vaccination.cost,
      },
    });

    res.status(201).json(vaccination);
  } catch (err) {
    console.error("Create Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// UPDATE VACCINATION
// ============================================================

exports.updateVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    if (vaccination.isDeleted) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    const before = getVaccinationAuditSnapshot(vaccination);
    const changedFields = [];

    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        const oldValue = vaccination[field];
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
          vaccination[field] = newValue;
        }
      }
    }

    if (changedFields.length === 0) {
      return res.json(vaccination);
    }

    vaccination.status = calculateStatus(vaccination.nextDueDate);

    await vaccination.save();

    emit(req, "vaccinationUpdated", vaccination);

    try {
      await syncLinkedBirdHealth({
        sourceRecord: vaccination,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "vaccinationRecord",
        payload: buildHealthPayload(vaccination),
        req,
      });
    } catch (syncError) {
      console.error("Vaccination update sync error:", syncError);
    }

    await logAudit(req, {
      action: "UPDATE",
      module: "Vaccinations",
      description: `Updated ${vaccination.vaccineName} vaccination for ${vaccination.pen}`,
      entityId: vaccination._id,
      entityName: vaccination.vaccineName,
      before,
      after: getVaccinationAuditSnapshot(vaccination),
      metadata: {
        changedFields,
      },
    });

    res.json(vaccination);
  } catch (err) {
    console.error("Update Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// DELETE VACCINATION (SOFT DELETE)
// ============================================================

exports.deleteVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    if (vaccination.isDeleted) {
      return res.status(400).json({
        error: "Vaccination record is already deleted",
      });
    }

    const before = getVaccinationAuditSnapshot(vaccination);

    vaccination.isDeleted = true;
    vaccination.deletedAt = new Date();
    vaccination.deletedBy = req.user.id;
    vaccination.deletedByName = req.user.name;
    vaccination.deletedByRole = req.user.role;

    await vaccination.save({ validateModifiedOnly: true });

    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: vaccination,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "vaccinationRecord",
        req,
      });
    } catch (syncError) {
      console.error("Vaccination deletion sync error:", syncError);
    }

    emit(req, "vaccinationDeleted", vaccination);

    await logAudit(req, {
      action: "DELETE",
      module: "Vaccinations",
      description: `Deleted vaccination record: ${vaccination.vaccineName}`,
      entityId: vaccination._id,
      entityName: vaccination.vaccineName,
      before,
      after: getVaccinationAuditSnapshot(vaccination),
      metadata: {
        deletedAt: vaccination.deletedAt,
        deletedByName: vaccination.deletedByName,
        deletedByRole: vaccination.deletedByRole,
      },
    });

    res.json({ message: "Vaccination deleted successfully" });
  } catch (err) {
    console.error("Delete Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ============================================================
// RESTORE VACCINATION
// ============================================================

exports.restoreVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    if (!vaccination.isDeleted) {
      return res.status(400).json({
        error: "Vaccination record is not deleted",
      });
    }

    const before = getVaccinationAuditSnapshot(vaccination);

    const previousDeletion = {
      deletedAt: vaccination.deletedAt,
      deletedByName: vaccination.deletedByName,
      deletedByRole: vaccination.deletedByRole,
    };

    vaccination.isDeleted = false;
    vaccination.deletedAt = null;
    vaccination.deletedBy = null;
    vaccination.deletedByName = "";
    vaccination.deletedByRole = "";

    await vaccination.save({ validateModifiedOnly: true });

    try {
      await restoreLinkedBirdHealth({
        sourceRecord: vaccination,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "vaccinationRecord",
        req,
      });
    } catch (syncError) {
      console.error("Vaccination restore sync error:", syncError);
    }

    emit(req, "vaccinationRestored", vaccination);

    await logAudit(req, {
      action: "RESTORE",
      module: "Vaccinations",
      description: `Restored vaccination record: ${vaccination.vaccineName}`,
      entityId: vaccination._id,
      entityName: vaccination.vaccineName,
      before,
      after: getVaccinationAuditSnapshot(vaccination),
      metadata: {
        previousDeletion,
      },
    });

    res.json(vaccination);
  } catch (err) {
    console.error("Restore Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};
