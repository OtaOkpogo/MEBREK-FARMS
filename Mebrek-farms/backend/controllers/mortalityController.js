const Mortality = require("../models/Mortality");
const BirdHealth = require("../models/BirdHealth");

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

    // Auto-log this mortality event as a Bird Health record so both
    // modules share one health timeline without duplicate manual entry.
    // Isolated in its own try/catch — if this fails, the mortality
    // record itself still saves and the person still gets a 201.
    try {
      const birdHealthRecord = await BirdHealth.create({
        date: record.date || new Date(),

        pen: record.birdBatch,

        healthIssue: record.cause,

        category: "Mortality",

        symptoms: `${record.numberDead} bird(s) died`,

        diagnosis: record.cause,

        actionTaken: "Mortality recorded",

        birdsAffected: record.numberDead || 0,

        severity: "Critical",

        status: "Dead",

        remarks: record.notes || "",

        mortalityRecord: record._id,

        recordedBy: req.user.id,
      });

      const io = req.app.get("io");
      if (io) {
        io.emit("birdHealthCreated", birdHealthRecord);
      }
    } catch (birdHealthErr) {
      console.error(
        "Auto Bird Health Record (Mortality) Error:",
        birdHealthErr,
      );
    }

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
