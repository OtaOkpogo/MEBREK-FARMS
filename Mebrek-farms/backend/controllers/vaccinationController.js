const Vaccination = require("../models/Vaccination");
const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
  restoreLinkedBirdHealth,
} = require("../services/healthSyncService");

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

exports.getVaccinations = async (req, res) => {
  try {
    const filter = req.user.role === "superadmin" ? {} : { isDeleted: false };

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

    res.status(201).json(vaccination);
  } catch (err) {
    console.error("Create Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    for (const field of UPDATABLE_FIELDS) {
      if (req.body[field] !== undefined) {
        vaccination[field] = req.body[field];
      }
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

    res.json(vaccination);
  } catch (err) {
    console.error("Update Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

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
        req,
      });
    } catch (syncError) {
      console.error("Vaccination deletion sync error:", syncError);
    }

    emit(req, "vaccinationDeleted", vaccination);
    res.json({ message: "Vaccination deleted successfully" });
  } catch (err) {
    console.error("Delete Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};

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

    vaccination.isDeleted = false;
    vaccination.deletedAt = null;
    vaccination.deletedBy = null;
    vaccination.deletedByName = null;
    vaccination.deletedByRole = null;

    await vaccination.save({ validateModifiedOnly: true });

    try {
      await restoreLinkedBirdHealth({
        sourceRecord: vaccination,
        sourceLinkField: "birdHealthRecord",
        req,
      });
    } catch (syncError) {
      console.error("Vaccination restore sync error:", syncError);
    }

    emit(req, "vaccinationRestored", vaccination);
    res.json(vaccination);
  } catch (err) {
    console.error("Restore Vaccination Error:", err);
    res.status(500).json({ error: err.message });
  }
};
