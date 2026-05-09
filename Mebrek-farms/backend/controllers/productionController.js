const Production = require("../models/Production");

exports.getProduction = async (req, res) => {
  try {
    const data = await Production.find().sort({
      createdAt: -1,
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};

exports.createProduction = async (req, res) => {
  try {
    const production = new Production(req.body);

    await production.save();

    res.json(production);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
};
