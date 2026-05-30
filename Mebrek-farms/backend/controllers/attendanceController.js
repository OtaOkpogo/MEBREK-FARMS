const Attendance = require("../models/Attendance");


// ================= GET ALL =================

exports.getAttendance = async (req, res) => {
  try {

    const attendance =
      await Attendance.find()
        .sort({ createdAt: -1 });

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

    const attendance =
      await Attendance.create(req.body);

    res.status(201).json(attendance);

  } catch (error) {

    res.status(500).json({
      error: error.message,
    });

  }
};


// ================= DELETE =================

exports.deleteAttendance = async (req, res) => {
  try {

    await Attendance.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message:
        "Attendance deleted successfully",
    });

  } catch (error) {

    res.status(500).json({
      error: error.message,
    });

  }
};
