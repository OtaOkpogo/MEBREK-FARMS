const Mortality = require("../models/Mortality");
const {
  syncLinkedBirdHealth,
  softDeleteLinkedBirdHealth,
} = require("../services/healthSyncService");

const buildHealthPayload = (record) => ({
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
});

exports.getMortality = async (req, res) => {
  try {
    const records = await Mortality.find()
      .sort({ createdAt: -1 })
      .populate("productionRecord", "date pen mortality")
      .populate("birdHealthRecord");

    res.json(records);
  } catch (err) {
    console.error("GET MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.createMortality = async (req, res) => {
  try {
    const record = await Mortality.create(req.body);

    try {
      await syncLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        payload: buildHealthPayload(record),
        req,
      });
    } catch (syncError) {
      console.error("Mortality → Bird Health sync error:", syncError);
    }

    res.status(201).json(record);
  } catch (err) {
    console.error("CREATE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateMortality = async (req, res) => {
  try {
    const record = await Mortality.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    if (record.productionRecord) {
      return res.status(409).json({
        message:
          "This mortality entry was generated from Production. Edit the production record instead.",
      });
    }

    const allowedFields = [
      "birdBatch",
      "numberDead",
      "cause",
      "estimatedLoss",
      "notes",
      "date",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        record[field] = req.body[field];
      }
    }

    await record.save();

    try {
      await syncLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        payload: buildHealthPayload(record),
        req,
      });
    } catch (syncError) {
      console.error("Mortality update sync error:", syncError);
    }

    res.json(record);
  } catch (err) {
    console.error("UPDATE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMortality = async (req, res) => {
  try {
    const record = await Mortality.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Mortality record not found",
      });
    }

    if (record.productionRecord) {
      return res.status(409).json({
        message:
          "This mortality entry was generated from Production. Delete the production record instead.",
      });
    }

    try {
      await softDeleteLinkedBirdHealth({
        sourceRecord: record,
        sourceLinkField: "birdHealthRecord",
        healthLinkField: "mortalityRecord",
        req,
      });
    } catch (syncError) {
      console.error("Mortality deletion sync error:", syncError);

      return res.status(500).json({
        message:
          "Could not synchronize the linked Bird Health record. Mortality was not deleted.",
      });
    }

    await Mortality.findByIdAndDelete(record._id);

    res.json({
      message: "Mortality record deleted successfully",
    });
  } catch (err) {
    console.error("DELETE MORTALITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
};
