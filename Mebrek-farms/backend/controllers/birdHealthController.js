const BirdHealth = require("../models/BirdHealth");

// Computes Overdue / Due Today / Upcoming for the follow-up date, live on
// every read — matches the pattern used for Vaccinations' nextDueDate.
// Returns null if there's no follow-up date set.
const calculateFollowUpStatus = (followUpDate) => {
  if (!followUpDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(followUpDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) return "Overdue";
  if (due.getTime() === today.getTime()) return "Due Today";
  return "Upcoming";
};

const withFollowUpStatus = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  obj.followUpStatus = calculateFollowUpStatus(obj.followUpDate);
  return obj;
};

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

    res.json(records.map(withFollowUpStatus));
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
      pen,
      healthIssue,
      birdsAffected,
      symptoms,
      severity,
      vetConsulted,
      diagnosis,
      actionTaken,
      status,
      remarks,
      category,
      medicationUsed,
      veterinarianName,
      followUpDate,
      costOfTreatment,
      currency,
      recoveryDate,
    } = req.body;

    if (!pen || !pen.trim()) {
      return res.status(400).json({ message: "Pen/House is required" });
    }

    if (!healthIssue || !healthIssue.trim()) {
      return res
        .status(400)
        .json({ message: "Health issue / disease is required" });
    }

    const record = await BirdHealth.create({
      date: date || Date.now(),
      pen,
      healthIssue,
      birdsAffected: Number(birdsAffected) || 0,
      symptoms,
      severity,
      vetConsulted: Boolean(vetConsulted),
      diagnosis,
      actionTaken,
      status,
      remarks,
      category,
      medicationUsed,
      veterinarianName,
      followUpDate: followUpDate || null,
      costOfTreatment: Number(costOfTreatment) || 0,
      currency: currency || "NGN",
      recoveryDate: recoveryDate || null,
      recordedBy: req.user?.id,
    });

    const populated = await record.populate("recordedBy", "role name");
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");
    if (io) {
      io.emit("birdHealthCreated", withStatus);
    }

    res.status(201).json(withStatus);
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
      pen,
      healthIssue,
      birdsAffected,
      symptoms,
      severity,
      vetConsulted,
      diagnosis,
      actionTaken,
      status,
      remarks,
      category,
      medicationUsed,
      veterinarianName,
      followUpDate,
      costOfTreatment,
      currency,
      recoveryDate,
    } = req.body;

    if (date !== undefined) record.date = date;
    if (pen !== undefined) record.pen = pen;
    if (healthIssue !== undefined) record.healthIssue = healthIssue;
    if (birdsAffected !== undefined)
      record.birdsAffected = Number(birdsAffected) || 0;
    if (symptoms !== undefined) record.symptoms = symptoms;
    if (severity !== undefined) record.severity = severity;
    if (vetConsulted !== undefined) record.vetConsulted = Boolean(vetConsulted);
    if (diagnosis !== undefined) record.diagnosis = diagnosis;
    if (actionTaken !== undefined) record.actionTaken = actionTaken;
    if (status !== undefined) record.status = status;
    if (remarks !== undefined) record.remarks = remarks;
    if (category !== undefined) record.category = category;
    if (medicationUsed !== undefined) record.medicationUsed = medicationUsed;
    if (veterinarianName !== undefined)
      record.veterinarianName = veterinarianName;
    if (followUpDate !== undefined) record.followUpDate = followUpDate || null;
    if (costOfTreatment !== undefined)
      record.costOfTreatment = Number(costOfTreatment) || 0;
    if (currency !== undefined) record.currency = currency;
    if (recoveryDate !== undefined) record.recoveryDate = recoveryDate || null;

    await record.save();

    const populated = await record.populate("recordedBy", "role name");
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");
    if (io) {
      io.emit("birdHealthUpdated", withStatus);
    }

    res.json(withStatus);
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
    record.deletedByName = req.user?.name;
    record.deletedByRole = req.user?.role;

    // validateBeforeSave: false — skip validation entirely on this save.
    // validateModifiedOnly wasn't sufficient here: required-field checks
    // can still fire on missing paths even when only unrelated fields
    // were changed. This save only ever touches isDeleted/deletedAt/
    // deletedBy* fields, so there's nothing meaningful to validate.
    await record.save({ validateBeforeSave: false });

    const populated = await record.populate([
      { path: "recordedBy", select: "role name" },
      { path: "deletedBy", select: "role name" },
    ]);
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");
    if (io) {
      io.emit("birdHealthDeleted", withStatus);
    }

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

    res.json(records.map(withFollowUpStatus));
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
    record.deletedByName = null;
    record.deletedByRole = null;

    // Same reasoning as deleteBirdHealthRecord above.
    await record.save({ validateBeforeSave: false });

    const populated = await record.populate("recordedBy", "role name");
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");
    if (io) {
      io.emit("birdHealthRestored", withStatus);
    }

    res.json(withStatus);
  } catch (err) {
    console.error("Restore Bird Health Record Error:", err);
    res.status(500).json({ message: err.message });
  }
};
