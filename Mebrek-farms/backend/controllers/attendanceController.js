const Attendance = require("../models/Attendance");

// ================= GET ALL =================
// Superadmin sees deleted records inline (with who deleted them);
// everyone else only sees active records — matches BirdHealth/
// Vaccinations pattern.

exports.getAttendance = async (req, res) => {
  try {
    const isSuperadmin = req.user?.role === "superadmin";

    const filter = isSuperadmin ? {} : { isDeleted: false };

    const attendance = await Attendance.find(filter)
      .sort({ createdAt: -1 })
      .populate("deletedBy", "role name");

    res.json(attendance);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= CREATE =================

exports.createAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.create(req.body);

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= DELETE (soft delete) =================

exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    attendance.isDeleted = true;
    attendance.deletedAt = new Date();
    attendance.deletedBy = req.user?.id;
    attendance.deletedByName = req.user?.name;
    attendance.deletedByRole = req.user?.role;

    // validateBeforeSave: false — this save only ever touches the
    // isDeleted/deletedAt/deletedBy* fields, so there's nothing
    // meaningful to re-validate, matching birdHealthController.js.
    await attendance.save({ validateBeforeSave: false });

    res.json({
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= GET DELETED (superadmin only — gated in route) =================

exports.getDeletedAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.find({ isDeleted: true })
      .sort({ deletedAt: -1 })
      .populate("deletedBy", "role name");

    res.json(attendance);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// ================= RESTORE (superadmin only — gated in route) =================

exports.restoreAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      _id: req.params.id,
      isDeleted: true,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "Deleted attendance record not found",
      });
    }

    attendance.isDeleted = false;
    attendance.deletedAt = null;
    attendance.deletedBy = null;
    attendance.deletedByName = null;
    attendance.deletedByRole = null;

    await attendance.save({ validateBeforeSave: false });

    res.json({
      message: "Attendance record restored successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};
