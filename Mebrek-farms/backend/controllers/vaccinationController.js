const Vaccination = require("../models/Vaccination");
const BirdHealth = require("../models/BirdHealth");

// =========================================
// Helper: Calculate Status
// =========================================
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

// =========================================
// GET ALL VACCINATIONS
// =========================================
exports.getVaccinations = async (req, res) => {
  try {
    let vaccinations;

    if (req.user.role === "superadmin") {
      vaccinations = await Vaccination.find().sort({
        vaccinationDate: -1,
      });
    } else {
      vaccinations = await Vaccination.find({
        isDeleted: false,
      }).sort({
        vaccinationDate: -1,
      });
    }

    // Always refresh status before sending
    vaccinations = vaccinations.map((item) => {
      const obj = item.toObject();
      obj.status = calculateStatus(obj.nextDueDate);
      return obj;
    });

    res.json(vaccinations);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// CREATE VACCINATION
// =========================================
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

    const io = req.app.get("io");
    if (io) {
      io.emit("newVaccination", vaccination);
    }

    // Auto-log this vaccination as a Bird Health record so both modules
    // share one health timeline without duplicate manual entry. Isolated
    // in its own try/catch — if this fails for any reason, the
    // vaccination itself still succeeds and the person still gets a
    // 201 response; we just log the Bird Health failure separately.
    try {
      const birdHealthRecord = await BirdHealth.create({
        date: vaccination.vaccinationDate || new Date(),

        pen: vaccination.pen,

        healthIssue: vaccination.vaccineName,

        category: "Vaccination",

        symptoms: "Preventive vaccination",

        diagnosis: vaccination.vaccineType || "Routine Vaccination",

        actionTaken: `Vaccination administered (${vaccination.route || "N/A"})`,

        birdsAffected: vaccination.birdsVaccinated || vaccination.quantity || 0,

        medicationUsed: vaccination.vaccineName,

        veterinarianName: vaccination.administeredBy?.name || req.user.name,

        followUpDate: vaccination.nextDueDate,

        followUpStatus: calculateStatus(vaccination.nextDueDate),

        status: "Recovered",

        remarks: vaccination.notes || "",

        recordedBy: req.user.id,
      });

      console.log(
        "Auto Bird Health Record (Vaccination) created:",
        birdHealthRecord._id,
      );

      if (io) {
        io.emit("birdHealthCreated", birdHealthRecord);
      }
    } catch (birdHealthErr) {
      console.error(
        "Auto Bird Health Record (Vaccination) Error:",
        birdHealthErr,
      );
    }

    res.status(201).json(vaccination);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// UPDATE VACCINATION
// =========================================

// Only these fields can be changed through the regular update
// endpoint. isDeleted/deletedAt/deletedBy* are deliberately excluded —
// previously Object.assign(vaccination, req.body) copied every field
// from the request body unfiltered, so a manager could include
// isDeleted: false in an update payload and silently restore a
// soft-deleted record without going through restoreVaccination's
// superadmin-only route, or set arbitrary values for those fields
// directly. administeredBy is also excluded so an update can't
// impersonate a different administerer after the fact.
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

exports.updateVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    UPDATABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        vaccination[field] = req.body[field];
      }
    });

    vaccination.status = calculateStatus(vaccination.nextDueDate);

    await vaccination.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("vaccinationUpdated", vaccination);
    }

    res.json(vaccination);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// DELETE VACCINATION (SOFT DELETE)
// =========================================
exports.deleteVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    vaccination.isDeleted = true;
    vaccination.deletedAt = new Date();
    vaccination.deletedBy = req.user.id;
    vaccination.deletedByName = req.user.name;
    vaccination.deletedByRole = req.user.role;

    // validateModifiedOnly: only re-validate the fields we actually
    // changed above. Without this, saving a soft-delete on an older
    // record fails if that record predates required fields like
    // vaccinationDate/quantityUsed, even though this save never
    // touches those fields.
    await vaccination.save({ validateModifiedOnly: true });

    const io = req.app.get("io");
    if (io) {
      io.emit("vaccinationDeleted", vaccination);
    }

    res.json({
      message: "Vaccination deleted successfully",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// =========================================
// RESTORE VACCINATION (SUPER ADMIN ONLY)
// =========================================
exports.restoreVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findById(req.params.id);

    if (!vaccination) {
      return res.status(404).json({
        error: "Vaccination record not found",
      });
    }

    vaccination.isDeleted = false;
    vaccination.deletedAt = null;
    vaccination.deletedBy = null;
    vaccination.deletedByName = null;
    vaccination.deletedByRole = null;

    // Same reasoning as deleteVaccination above.
    await vaccination.save({ validateModifiedOnly: true });

    const io = req.app.get("io");
    if (io) {
      io.emit("vaccinationRestored", vaccination);
    }

    res.json(vaccination);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message,
    });
  }
};
