const Mortality = require("../models/Mortality");

// ================= GET =================

exports.getMortality = async (req, res) => {
  try {
    const records = await Mortality.find().sort({
      createdAt: -1,
    });

    res.json(records);
  } catch (err) {
    console.error("GET MORTALITY ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= CREATE =================

exports.createMortality = async (req, res) => {
  try {
    console.log("Incoming Mortality Data:", req.body);

    const record = new Mortality(req.body);

    await record.save();

    res.status(201).json(record);
  } catch (err) {
    console.error("CREATE MORTALITY ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= UPDATE =================

exports.updateMortality = async (req, res) => {
  try {
    const record = await Mortality.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    res.json(record);
  } catch (err) {
    console.error("UPDATE MORTALITY ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};

// ================= DELETE =================

exports.deleteMortality = async (req, res) => {
  try {
    const record = await Mortality.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    res.json({
      message: "Mortality record deleted successfully",
    });
  } catch (err) {
    console.error("DELETE MORTALITY ERROR:", err);

    res.status(500).json({
      error: err.message,
    });
  }
};
