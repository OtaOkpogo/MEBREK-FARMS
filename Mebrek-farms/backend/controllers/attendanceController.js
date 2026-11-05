const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Worker = require("../models/Worker");
const { logAudit } = require("../utils/auditLogger");

const ALLOWED_STATUSES = [
  "Present",
  "Absent",
  "Late",
  "Leave",
  "Sick Leave",
  "Holiday",
  "Off Day",
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// ============================================================
// AUDIT SNAPSHOT
// ============================================================

function getAttendanceAuditSnapshot(record) {
  if (!record) return null;

  const data = record.toObject ? record.toObject() : record;

  return {
    workerId: data.workerId ? String(data.workerId) : null,
    workerName: data.workerName,
    role: data.role,
    attendanceDate: data.attendanceDate,
    status: data.status,
    checkInTime: data.checkInTime,
    checkOutTime: data.checkOutTime,
    scheduledStartTime: data.scheduledStartTime,
    scheduledEndTime: data.scheduledEndTime,
    isLate: data.isLate,
    workingHours: data.workingHours,
    remarks: data.remarks,
    isDeleted: data.isDeleted,
    deletedAt: data.deletedAt,
    deletedByName: data.deletedByName,
    deletedByRole: data.deletedByRole,
  };
}

function getChangedFields(before, after) {
  return Object.keys(after).filter(
    (field) =>
      JSON.stringify(before[field] ?? null) !==
      JSON.stringify(after[field] ?? null),
  );
}

// ============================================================
// DATE AND TIME HELPERS
// ============================================================

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function calculateWorkingHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;

  if (!TIME_PATTERN.test(checkIn) || !TIME_PATTERN.test(checkOut)) {
    return 0;
  }

  const toMinutes = (value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  let minutes = toMinutes(checkOut) - toMinutes(checkIn);

  // Support shifts that finish after midnight.
  if (minutes < 0) minutes += 24 * 60;

  return Math.round((minutes / 60) * 100) / 100;
}

function isLateArrival(checkIn, scheduledStart) {
  if (!checkIn || !TIME_PATTERN.test(checkIn)) return false;

  const validStart = TIME_PATTERN.test(scheduledStart || "")
    ? scheduledStart
    : "08:00";

  return checkIn > validStart;
}

function applyCalculatedFields(record) {
  record.scheduledStartTime = TIME_PATTERN.test(record.scheduledStartTime || "")
    ? record.scheduledStartTime
    : "08:00";

  record.isLate = isLateArrival(record.checkInTime, record.scheduledStartTime);

  record.workingHours = calculateWorkingHours(
    record.checkInTime,
    record.checkOutTime,
  );

  if (record.checkInTime && record.isLate && record.status === "Present") {
    record.status = "Late";
  } else if (record.checkInTime && !record.isLate && record.status === "Late") {
    record.status = "Present";
  }
}

function validateTimeFields(body) {
  for (const field of ["checkInTime", "checkOutTime"]) {
    const value = body[field];

    if (value && !TIME_PATTERN.test(value)) {
      return `${field} must use HH:mm format, for example 08:00.`;
    }
  }

  return null;
}

async function resolveWorker(workerId) {
  if (!workerId || !mongoose.isValidObjectId(workerId)) {
    return null;
  }

  return Worker.findOne({
    _id: workerId,
    status: "Active",
  });
}

// ============================================================
// GET ACTIVE ATTENDANCE
// ============================================================

exports.getAttendance = async (req, res) => {
  try {
    const filter = req.user?.role === "superadmin" ? {} : { isDeleted: false };

    const attendance = await Attendance.find(filter)
      .sort({ attendanceDate: -1, createdAt: -1 })
      .populate("deletedBy", "role name");

    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// ACTIVE WORKERS FOR ATTENDANCE
// ============================================================

exports.getAttendanceWorkers = async (req, res) => {
  try {
    const workers = await Worker.find({ status: "Active" })
      .select(
        "employeeId firstName lastName role department workShift startTime endTime status",
      )
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return res.json(
      workers.map((worker) => ({
        ...worker,
        workerName: `${worker.firstName} ${worker.lastName}`.trim(),
      })),
    );
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// CREATE ATTENDANCE
// ============================================================

exports.createAttendance = async (req, res) => {
  try {
    const {
      workerId,
      workerName,
      role,
      status = "Present",
      checkInTime = "",
      checkOutTime = "",
      remarks = "",
    } = req.body;

    const attendanceDate = req.body.attendanceDate || getLocalDateString();

    if (!validDateString(attendanceDate)) {
      return res.status(400).json({
        message: "Provide a valid attendance date in YYYY-MM-DD format.",
      });
    }

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid attendance status.",
      });
    }

    const timeError = validateTimeFields({ checkInTime, checkOutTime });

    if (timeError) {
      return res.status(400).json({ message: timeError });
    }

    let worker = null;

    if (workerId) {
      worker = await resolveWorker(workerId);

      if (!worker) {
        return res.status(404).json({
          message: "Active worker not found. Refresh the worker list.",
        });
      }
    }

    const finalWorkerName =
      workerName ||
      (worker ? `${worker.firstName} ${worker.lastName}`.trim() : "");

    const finalRole = role || worker?.role || "";

    if (!finalWorkerName.trim() || !finalRole.trim()) {
      return res.status(400).json({
        message: "Select a worker or provide both worker name and role.",
      });
    }

    // Prevent duplicate records for a registered worker and date.
    // Include soft-deleted records to prevent accidental re-creation.
    if (worker) {
      const duplicate = await Attendance.findOne({
        workerId: worker._id,
        attendanceDate,
      });

      if (duplicate) {
        return res.status(409).json({
          message: `${finalWorkerName} already has an attendance record for ${attendanceDate}.`,
        });
      }
    }

    const attendance = new Attendance({
      workerId: worker?._id || null,
      workerName: finalWorkerName.trim(),
      role: finalRole.trim(),
      attendanceDate,
      status,
      checkInTime,
      checkOutTime,
      scheduledStartTime:
        worker?.startTime && TIME_PATTERN.test(worker.startTime)
          ? worker.startTime
          : "08:00",
      scheduledEndTime:
        worker?.endTime && TIME_PATTERN.test(worker.endTime)
          ? worker.endTime
          : "",
      remarks: String(remarks || "").trim(),
    });

    applyCalculatedFields(attendance);
    await attendance.save();

    await logAudit(req, {
      action: "CREATE",
      module: "Attendance",
      description: `Attendance recorded for ${attendance.workerName}`,
      entityId: attendance._id,
      entityName: attendance.workerName,
      after: getAttendanceAuditSnapshot(attendance),
      metadata: {
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
        workingHours: attendance.workingHours,
        isLate: attendance.isLate,
      },
    });

    return res.status(201).json(attendance);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "An attendance record already exists for this worker and date.",
      });
    }

    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// UPDATE ATTENDANCE / CHECK-IN / CHECK-OUT
// ============================================================

exports.updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Active attendance record not found.",
      });
    }

    const before = getAttendanceAuditSnapshot(attendance);

    const allowedFields = ["status", "checkInTime", "checkOutTime", "remarks"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        attendance[field] = req.body[field];
      }
    }

    if (!ALLOWED_STATUSES.includes(attendance.status)) {
      return res.status(400).json({
        message: "Invalid attendance status.",
      });
    }

    const timeError = validateTimeFields(attendance);

    if (timeError) {
      return res.status(400).json({ message: timeError });
    }

    applyCalculatedFields(attendance);
    await attendance.save();

    const after = getAttendanceAuditSnapshot(attendance);
    const changedFields = getChangedFields(before, after);

    if (changedFields.length > 0) {
      await logAudit(req, {
        action: "UPDATE",
        module: "Attendance",
        description: `Attendance updated for ${attendance.workerName}`,
        entityId: attendance._id,
        entityName: attendance.workerName,
        before,
        after,
        metadata: {
          changedFields,
          attendanceDate: attendance.attendanceDate,
          status: attendance.status,
          workingHours: attendance.workingHours,
          isLate: attendance.isLate,
        },
      });
    }

    return res.json({
      message: "Attendance updated successfully.",
      attendance,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// SOFT DELETE ATTENDANCE
// ============================================================

// Manager/superadmin route restriction remains in the routes file.
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found.",
      });
    }

    const before = getAttendanceAuditSnapshot(attendance);

    attendance.isDeleted = true;
    attendance.deletedAt = new Date();
    attendance.deletedBy = req.user?.id || req.user?._id || null;
    attendance.deletedByName = req.user?.name || null;
    attendance.deletedByRole = req.user?.role || null;

    await attendance.save({ validateBeforeSave: false });

    const after = getAttendanceAuditSnapshot(attendance);

    await logAudit(req, {
      action: "DELETE",
      module: "Attendance",
      description: `Attendance deleted for ${attendance.workerName}`,
      entityId: attendance._id,
      entityName: attendance.workerName,
      before,
      after,
      metadata: {
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
        deletedByName: attendance.deletedByName,
      },
    });

    return res.json({
      message: "Attendance record deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// GET DELETED ATTENDANCE
// ============================================================

exports.getDeletedAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("deletedBy", "role name");

    return res.json(attendance);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================
// RESTORE ATTENDANCE
// ============================================================

exports.restoreAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Deleted attendance record not found.",
      });
    }

    // Prevent restoring a record when another active record already
    // exists for the same registered worker and attendance date.
    if (attendance.workerId && attendance.attendanceDate) {
      const existingActiveRecord = await Attendance.findOne({
        _id: { $ne: attendance._id },
        workerId: attendance.workerId,
        attendanceDate: attendance.attendanceDate,
        isDeleted: false,
      }).select("_id");

      if (existingActiveRecord) {
        return res.status(409).json({
          message:
            "Cannot restore this record because an active attendance record already exists for this worker and date.",
        });
      }
    }

    const before = getAttendanceAuditSnapshot(attendance);

    attendance.isDeleted = false;
    attendance.deletedAt = null;
    attendance.deletedBy = null;
    attendance.deletedByName = null;
    attendance.deletedByRole = null;

    await attendance.save({ validateBeforeSave: false });

    const after = getAttendanceAuditSnapshot(attendance);

    await logAudit(req, {
      action: "RESTORE",
      module: "Attendance",
      description: `Attendance restored for ${attendance.workerName}`,
      entityId: attendance._id,
      entityName: attendance.workerName,
      before,
      after,
      metadata: {
        attendanceDate: attendance.attendanceDate,
        status: attendance.status,
        workingHours: attendance.workingHours,
      },
    });

    return res.json({
      message: "Attendance record restored successfully.",
      attendance,
    });
  } catch (error) {
    // Also handle a conflict caused by two requests racing to restore
    // or create attendance for the same worker and date.
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Cannot restore this record because an active attendance record already exists for this worker and date.",
      });
    }

    console.error("Restore attendance error:", error);

    return res.status(500).json({
      message: "Failed to restore attendance record.",
    });
  }
};
