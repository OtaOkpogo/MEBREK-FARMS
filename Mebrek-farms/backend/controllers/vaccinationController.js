const Vaccination = require(
  "../models/Vaccination"
);


// ================= GET =================

exports.getVaccinations =
  async (req, res) => {
    try {

      const records =
        await Vaccination.find().sort({
          createdAt: -1,
        });

      res.json(records);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= CREATE =================

exports.createVaccination =
  async (req, res) => {
    try {

      const record =
        new Vaccination(req.body);

      await record.save();

      res.json(record);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= UPDATE =================

exports.updateVaccination =
  async (req, res) => {
    try {

      const record =
        await Vaccination.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );

      res.json(record);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= DELETE =================

exports.deleteVaccination =
  async (req, res) => {
    try {

      await Vaccination.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Vaccination record deleted",
      });

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };
