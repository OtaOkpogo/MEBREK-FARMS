const BirdHealth = require("../models/BirdHealth");
const { logAudit } = require("../utils/auditLogger");

// ============================================================
// AUDIT SNAPSHOT
// ============================================================

const getBirdHealthAuditSnapshot = (record) => {
  if (!record) return null;

  const data = record.toObject ? record.toObject() : record;

  return {
    date: data.date,
    pen: data.pen,
    healthIssue: data.healthIssue,
    birdsAffected: data.birdsAffected,
    symptoms: data.symptoms,
    severity: data.severity,
    vetConsulted: data.vetConsulted,
    diagnosis: data.diagnosis,
    actionTaken: data.actionTaken,
    status: data.status,
    remarks: data.remarks,
    category: data.category,
    medicationUsed: data.medicationUsed,
    veterinarianName: data.veterinarianName,
    followUpDate: data.followUpDate,
    costOfTreatment: data.costOfTreatment,
    currency: data.currency,
    recoveryDate: data.recoveryDate,
    isDeleted: data.isDeleted,
    deletedAt: data.deletedAt,
    deletedByName: data.deletedByName,
    deletedByRole: data.deletedByRole,
  };
};

// ============================================================
// FOLLOW-UP STATUS
// ============================================================

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

// ============================================================
// GET BIRD HEALTH RECORDS
// ============================================================

// @desc   Get bird health records
// @route  GET /api/bird-health
exports.getBirdHealthRecords = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    const filter = isSuperadmin ? {} : { isDeleted: false };

    const records = await BirdHealth.find(filter)
      .sort({ date: -1 })
      .populate("recordedBy", "role name")
      .populate("deletedBy", "role name");

    return res.json(records.map(withFollowUpStatus));
  } catch (err) {
    console.error("Get Bird Health Records Error:", err);

    return res.status(500).json({ message: err.message });
  }
};

// ============================================================
// CREATE BIRD HEALTH RECORD
// ============================================================

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
      return res.status(400).json({
        message: "Pen/House is required",
      });
    }

    if (!healthIssue || !healthIssue.trim()) {
      return res.status(400).json({
        message: "Health issue / disease is required",
      });
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

    await logAudit(req, {
      action: "CREATE",
      module: "Bird Health",
      description: `Bird health record created: ${record.healthIssue}`,
      entityId: record._id,
      entityName: record.healthIssue,
      after: getBirdHealthAuditSnapshot(record),
      metadata: {
        pen: record.pen,
        birdsAffected: record.birdsAffected,
        severity: record.severity,
        category: record.category,
        costOfTreatment: record.costOfTreatment,
        currency: record.currency,
      },
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("birdHealthCreated", withStatus);
    }

    return res.status(201).json(withStatus);
  } catch (err) {
    console.error("Create Bird Health Record Error:", err);

    return res.status(500).json({ message: err.message });
  }
};

// ============================================================
// UPDATE BIRD HEALTH RECORD
// ============================================================

// @desc   Update a bird health record
// @route  PUT /api/bird-health/:id
exports.updateBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!record) {
      return res.status(404).json({
        message: "Bird health record not found",
      });
    }

    const before = getBirdHealthAuditSnapshot(record);

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

    if (birdsAffected !== undefined) {
      record.birdsAffected = Number(birdsAffected) || 0;
    }

    if (symptoms !== undefined) record.symptoms = symptoms;
    if (severity !== undefined) record.severity = severity;

    if (vetConsulted !== undefined) {
      record.vetConsulted = Boolean(vetConsulted);
    }

    if (diagnosis !== undefined) record.diagnosis = diagnosis;
    if (actionTaken !== undefined) record.actionTaken = actionTaken;
    if (status !== undefined) record.status = status;
    if (remarks !== undefined) record.remarks = remarks;
    if (category !== undefined) record.category = category;

    if (medicationUsed !== undefined) {
      record.medicationUsed = medicationUsed;
    }

    if (veterinarianName !== undefined) {
      record.veterinarianName = veterinarianName;
    }

    if (followUpDate !== undefined) {
      record.followUpDate = followUpDate || null;
    }

    if (costOfTreatment !== undefined) {
      record.costOfTreatment = Number(costOfTreatment) || 0;
    }

    if (currency !== undefined) record.currency = currency;

    if (recoveryDate !== undefined) {
      record.recoveryDate = recoveryDate || null;
    }

    await record.save();

    const after = getBirdHealthAuditSnapshot(record);

    const changedFields = Object.keys(after).filter(
      (field) =>
        JSON.stringify(before[field] ?? null) !==
        JSON.stringify(after[field] ?? null),
    );

    if (changedFields.length > 0) {
      await logAudit(req, {
        action: "UPDATE",
        module: "Bird Health",
        description: `Bird health record updated: ${record.healthIssue}`,
        entityId: record._id,
        entityName: record.healthIssue,
        before,
        after,
        metadata: {
          changedFields,
          pen: record.pen,
          birdsAffected: record.birdsAffected,
          severity: record.severity,
          costOfTreatment: record.costOfTreatment,
          currency: record.currency,
        },
      });
    }

    const populated = await record.populate("recordedBy", "role name");
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");

    if (io) {
      io.emit("birdHealthUpdated", withStatus);
    }

    return res.json(withStatus);
  } catch (err) {
    console.error("Update Bird Health Record Error:", err);

    return res.status(500).json({ message: err.message });
  }
};

// ============================================================
// DELETE BIRD HEALTH RECORD
// ============================================================

// @desc   Soft delete a bird health record
// @route  DELETE /api/bird-health/:id
exports.deleteBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!record) {
      return res.status(404).json({
        message: "Bird health record not found",
      });
    }

    const before = getBirdHealthAuditSnapshot(record);

    record.isDeleted = true;
    record.deletedAt = new Date();
    record.deletedBy = req.user?.id;
    record.deletedByName = req.user?.name;
    record.deletedByRole = req.user?.role;

    // This save only changes deletion metadata.
    await record.save({ validateBeforeSave: false });

    const after = getBirdHealthAuditSnapshot(record);

    await logAudit(req, {
      action: "DELETE",
      module: "Bird Health",
      description: `Bird health record deleted: ${record.healthIssue}`,
      entityId: record._id,
      entityName: record.healthIssue,
      before,
      after,
      metadata: {
        pen: record.pen,
        birdsAffected: record.birdsAffected,
        severity: record.severity,
        deletedByName: record.deletedByName,
      },
    });

    const populated = await record.populate([
      { path: "recordedBy", select: "role name" },
      { path: "deletedBy", select: "role name" },
    ]);

    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");

    if (io) {
      io.emit("birdHealthDeleted", withStatus);
    }

    return res.json({
      message: "Bird health record deleted",
    });
  } catch (err) {
    console.error("Delete Bird Health Record Error:", err);

    return res.status(500).json({ message: err.message });
  }
};

// ============================================================
// GET DELETED BIRD HEALTH RECORDS
// ============================================================

// @desc   Get soft-deleted bird health records
// @route  GET /api/bird-health/deleted
exports.getDeletedBirdHealthRecords = async (req, res) => {
  try {
    const records = await BirdHealth.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("recordedBy", "role name")
      .populate("deletedBy", "role name");

    return res.json(records.map(withFollowUpStatus));
  } catch (err) {
    console.error("Get Deleted Bird Health Records Error:", err);

    return res.status(500).json({ message: err.message });
  }
};

// ============================================================
// RESTORE BIRD HEALTH RECORD
// ============================================================

// @desc   Restore a soft-deleted bird health record
// @route  PUT /api/bird-health/:id/restore
exports.restoreBirdHealthRecord = async (req, res) => {
  try {
    const record = await BirdHealth.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!record) {
      return res.status(404).json({
        message: "Deleted bird health record not found",
      });
    }

    const before = getBirdHealthAuditSnapshot(record);

    record.isDeleted = false;
    record.deletedAt = null;
    record.deletedBy = null;
    record.deletedByName = null;
    record.deletedByRole = null;

    // This save only changes deletion metadata.
    await record.save({ validateBeforeSave: false });

    const after = getBirdHealthAuditSnapshot(record);

    await logAudit(req, {
      action: "RESTORE",
      module: "Bird Health",
      description: `Bird health record restored: ${record.healthIssue}`,
      entityId: record._id,
      entityName: record.healthIssue,
      before,
      after,
      metadata: {
        pen: record.pen,
        birdsAffected: record.birdsAffected,
        severity: record.severity,
      },
    });

    const populated = await record.populate("recordedBy", "role name");
    const withStatus = withFollowUpStatus(populated);

    const io = req.app.get("io");

    if (io) {
      io.emit("birdHealthRestored", withStatus);
    }

    return res.json(withStatus);
  } catch (err) {
    console.error("Restore Bird Health Record Error:", err);

    return res.status(500).json({ message: err.message });
  }
};
