const Vaccination = require("../models/Vaccination");

// @desc   Get vaccination records. Superadmin sees deleted records inline
//         (with who deleted them); everyone else only sees active records.
// @route  GET /api/vaccinations
exports.getVaccinations = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    const filter = isSuperadmin ? {} : { isDeleted: false };

    const vaccinations = await Vaccination.find(filter)
      .sort({ createdAt: -1 })
      .populate("deletedBy", "role name");

    res.json(vaccinations);
  } catch (err) {
    console.error("Get Vaccinations Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Create a vaccination record
// @route  POST /api/vaccinations
exports.createVaccination = async (req, res) => {
  try {
    const {
      vaccineName,
      birdBatch,
      quantity,
      administeredBy,
      dosage,
      nextDueDate,
      notes,
    } = req.body;

    if (!vaccineName || !vaccineName.trim()) {
      return res.status(400).json({ message: "Vaccine name is required" });
    }

    if (!birdBatch || !birdBatch.trim()) {
      return res.status(400).json({ message: "Bird batch is required" });
    }

    if (quantity === undefined || quantity === null || quantity === "") {
      return res.status(400).json({ message: "Quantity is required" });
    }

    const vaccination = await Vaccination.create({
      vaccineName,
      birdBatch,
      quantity: Number(quantity),
      administeredBy,
      dosage,
      nextDueDate,
      notes,
    });

    res.status(201).json(vaccination);
  } catch (err) {
    console.error("Create Vaccination Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Update a vaccination record
// @route  PUT /api/vaccinations/:id
exports.updateVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    const {
      vaccineName,
      birdBatch,
      quantity,
      administeredBy,
      dosage,
      nextDueDate,
      notes,
    } = req.body;

    if (vaccineName !== undefined) vaccination.vaccineName = vaccineName;
    if (birdBatch !== undefined) vaccination.birdBatch = birdBatch;
    if (quantity !== undefined) vaccination.quantity = Number(quantity) || 0;
    if (administeredBy !== undefined)
      vaccination.administeredBy = administeredBy;
    if (dosage !== undefined) vaccination.dosage = dosage;
    if (nextDueDate !== undefined) vaccination.nextDueDate = nextDueDate;
    if (notes !== undefined) vaccination.notes = notes;

    await vaccination.save();

    res.json(vaccination);
  } catch (err) {
    console.error("Update Vaccination Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Soft delete a vaccination record
// @route  DELETE /api/vaccinations/:id
exports.deleteVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!vaccination) {
      return res.status(404).json({ message: "Vaccination record not found" });
    }

    vaccination.isDeleted = true;
    vaccination.deletedAt = new Date();
    vaccination.deletedBy = req.user?.id;

    await vaccination.save();

    res.json({ message: "Vaccination record deleted" });
  } catch (err) {
    console.error("Delete Vaccination Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Get soft-deleted vaccination records (superadmin only — gated in route)
// @route  GET /api/vaccinations/deleted
exports.getDeletedVaccinations = async (req, res) => {
  try {
    const vaccinations = await Vaccination.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("deletedBy", "role name");

    res.json(vaccinations);
  } catch (err) {
    console.error("Get Deleted Vaccinations Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Restore a soft-deleted vaccination record (superadmin only — gated in route)
// @route  PUT /api/vaccinations/:id/restore
exports.restoreVaccination = async (req, res) => {
  try {
    const vaccination = await Vaccination.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!vaccination) {
      return res
        .status(404)
        .json({ message: "Deleted vaccination record not found" });
    }

    vaccination.isDeleted = false;
    vaccination.deletedAt = null;
    vaccination.deletedBy = null;

    await vaccination.save();

    res.json(vaccination);
  } catch (err) {
    console.error("Restore Vaccination Error:", err);
    res.status(500).json({ message: err.message });
  }
};
