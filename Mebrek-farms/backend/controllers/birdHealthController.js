const BirdHealth = require("../models/BirdHealth");

// @desc   Get bird health records. Superadmin sees deleted records inline
//         (with who deleted them); everyone else only sees active records.
// @route  GET /api/bird-health
exports.getBirdHealthRecords = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    const filter = isSuperadmin ? {} : { isDeleted: false };

    const records = await BirdHealth.find(filter)
      .sort({ date: -1 })
      .populate("recordedBy", "role name")
      .populate("deletedBy", "role name");

    res.json(records);
  } catch (err) {
    console.error("Get Bird Health Records Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Create a bird health record
// @route  POST /api/bird-health
exports.createBirdHealthRecord = async (req, res) => {
  try {
    const {
      date,
      penOrHouse,
      healthIssue,
      birdsAffected,
      symptoms,
      severity,
      vetConsulted,
      diagnosis,
      actionTaken,
      status,
      remarks,
    } = req.body;

    if (!penOrHouse || !penOrHouse.trim()) {
      return res.status(400).json({ message: "Pen/House is required" });
    }

    if (!healthIssue || !healthIssue.trim()) {
      return res
        .status(400)
        .json({ message: "Health issue / disease is required" });
    }

    const record = await BirdHealth.create({
      date: date || Date.now(),
      penOrHouse,
      healthIssue,
      birdsAffected: Number(birdsAffected) || 0,
      symptoms,
      severity,
      vetConsulted: Boolean(vetConsulted),
      diagnosis,
      actionTaken,
      status,
      remarks,
      recordedBy: req.user?.id,
    });

    const populated = await record.populate("recordedBy", "role name");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create Bird Health Record Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Update a bird health record
// @route  PUT /api/bird-health/:id
exports.updateBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!record) {
      return res.status(404).json({ message: "Bird health record not found" });
    }

    const {
      date,
      penOrHouse,
      healthIssue,
      birdsAffected,
      symptoms,
      severity,
      vetConsulted,
      diagnosis,
      actionTaken,
      status,
      remarks,
    } = req.body;

    if (date !== undefined) record.date = date;
    if (penOrHouse !== undefined) record.penOrHouse = penOrHouse;
    if (healthIssue !== undefined) record.healthIssue = healthIssue;
    if (birdsAffected !== undefined) record.birdsAffected = Number(birdsAffected) || 0;
    if (symptoms !== undefined) record.symptoms = symptoms;
    if (severity !== undefined) record.severity = severity;
    if (vetConsulted !== undefined) record.vetConsulted = Boolean(vetConsulted);
    if (diagnosis !== undefined) record.diagnosis = diagnosis;
    if (actionTaken !== undefined) record.actionTaken = actionTaken;
    if (status !== undefined) record.status = status;
    if (remarks !== undefined) record.remarks = remarks;

    await record.save();

    const populated = await record.populate("recordedBy", "role name");

    res.json(populated);
  } catch (err) {
    console.error("Update Bird Health Record Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Soft delete a bird health record
// @route  DELETE /api/bird-health/:id
exports.deleteBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!record) {
      return res.status(404).json({ message: "Bird health record not found" });
    }

    record.isDeleted = true;
    record.deletedAt = new Date();
    record.deletedBy = req.user?.id;

    await record.save();

    res.json({ message: "Bird health record deleted" });
  } catch (err) {
    console.error("Delete Bird Health Record Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Get soft-deleted bird health records (superadmin only — gated in route)
// @route  GET /api/bird-health/deleted
exports.getDeletedBirdHealthRecords = async (req, res) => {
  try {
    const records = await BirdHealth.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("recordedBy", "role name")
      .populate("deletedBy", "role name");

    res.json(records);
  } catch (err) {
    console.error("Get Deleted Bird Health Records Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc   Restore a soft-deleted bird health record (superadmin only — gated in route)
// @route  PUT /api/bird-health/:id/restore
exports.restoreBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!record) {
      return res
        .status(404)
        .json({ message: "Deleted bird health record not found" });
    }

    record.isDeleted = false;
    record.deletedAt = null;
    record.deletedBy = null;

    await record.save();

    const populated = await record.populate("recordedBy", "role name");

    res.json(populated);
  } catch (err) {
    console.error("Restore Bird Health Record Error:", err);
    res.status(500).json({ message: err.message });
  }
};
