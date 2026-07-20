const Medication = require("../models/Medication");
const BirdHealth = require("../models/BirdHealth");

// @desc   Get medication records. Superadmin sees deleted records inline
//         (with who deleted them); everyone else only sees active records.
// @route  GET /api/medications
exports.getMedications = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    // Superadmin: no filter, so deleted records are included.
    // Everyone else: only active records, exactly as before.
    const filter = isSuperadmin ? {} : { isDeleted: false };

    const medications = await Medication.find(filter)
      .sort({ dateAdministered: -1 })
      .populate("administeredBy", "name email")
      .populate("deletedBy", "role name");

    res.json(medications);
  } catch (err) {
    console.error("Get Medications Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Create a medication record
// @route  POST /api/medications
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
      return res.status(400).json({ message: "Medication name is required" });
    }

    const medication = await Medication.create({
      medicationName,
      dosage,
      purpose,
      administeredTo,
      dateAdministered: dateAdministered || Date.now(),
      administeredBy: req.user?.id,
    });

    // Auto-log this medication as a Bird Health record so both modules
    // share one health timeline without duplicate manual entry. Isolated
    // in its own try/catch — if this fails, the medication record itself
    // still saves and the person still gets a 201.
    try {
      const actionTaken = [purpose, dosage].filter(Boolean).join(" — ");

      const birdHealthRecord = await BirdHealth.create({
        date: medication.dateAdministered || new Date(),

        pen: medication.administeredTo,

        healthIssue: medication.medicationName,

        category: "Medication",

        symptoms: "Medication administered",

        diagnosis: purpose || "Treatment",

        medicationUsed: medication.medicationName,

        actionTaken: actionTaken || "Medication administered",

        birdsAffected: 1,

        severity: "Low",

        status: "Recovering",

        remarks: purpose || "",

        recordedBy: req.user.id,
      });

      const io = req.app.get("io");
      if (io) {
        io.emit("birdHealthCreated", birdHealthRecord);
      }
    } catch (birdHealthErr) {
      console.error(
        "Auto Bird Health Record (Medication) Error:",
        birdHealthErr,
      );
    }

    res.status(201).json(medication);
  } catch (err) {
    console.error("Create Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Update a medication record
// @route  PUT /api/medications/:id
exports.updateMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!medication) {
      return res.status(404).json({ message: "Medication record not found" });
    }

    const {
      medicationName,
      dosage,
      purpose,
      administeredTo,
      dateAdministered,
    } = req.body;

    if (medicationName !== undefined)
      medication.medicationName = medicationName;
    if (dosage !== undefined) medication.dosage = dosage;
    if (purpose !== undefined) medication.purpose = purpose;
    if (administeredTo !== undefined)
      medication.administeredTo = administeredTo;
    if (dateAdministered !== undefined)
      medication.dateAdministered = dateAdministered;

    await medication.save();

    res.json(medication);
  } catch (err) {
    console.error("Update Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Soft delete a medication record
// @route  DELETE /api/medications/:id
exports.deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!medication) {
      return res.status(404).json({ message: "Medication record not found" });
    }

    medication.isDeleted = true;
    medication.deletedAt = new Date();
    medication.deletedBy = req.user?.id;

    await medication.save();

    res.json({ message: "Medication record deleted" });
  } catch (err) {
    console.error("Delete Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Get soft-deleted medication records (superadmin only — gated in route)
// @route  GET /api/medications/deleted
exports.getDeletedMedications = async (req, res) => {
  try {
    const medications = await Medication.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("administeredBy", "name email")
      .populate("deletedBy", "name email");

    res.json(medications);
  } catch (err) {
    console.error("Get Deleted Medications Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Restore a soft-deleted medication record (superadmin only — gated in route)
// @route  PUT /api/medications/:id/restore
exports.restoreMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!medication) {
      return res
        .status(404)
        .json({ message: "Deleted medication record not found" });
    }

    medication.isDeleted = false;
    medication.deletedAt = null;
    medication.deletedBy = null;

    await medication.save();

    res.json(medication);
  } catch (err) {
    console.error("Restore Medication Error:", err);
    res.status(500).json({ message: err.message });
  }
};
