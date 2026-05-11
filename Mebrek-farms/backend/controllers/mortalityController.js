const Mortality = require(
  "../models/Mortality"
);


// ================= GET =================

exports.getMortality =
  async (req, res) => {
    try {

      const records =
        await Mortality.find().sort({
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

exports.createMortality =
  async (req, res) => {
    try {

      const record =
        new Mortality(req.body);

      await record.save();

      res.json(record);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= UPDATE =================

exports.updateMortality =
  async (req, res) => {
    try {

      const record =
        await Mortality.findByIdAndUpdate(
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

exports.deleteMortality =
  async (req, res) => {
    try {

      await Mortality.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Mortality record deleted",
      });

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };
