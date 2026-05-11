const Warehouse = require(
  "../models/Warehouse"
);


// ================= GET =================

exports.getWarehouseItems =
  async (req, res) => {
    try {

      const items =
        await Warehouse.find().sort({
          createdAt: -1,
        });

      res.json(items);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= CREATE =================

exports.createWarehouseItem =
  async (req, res) => {
    try {

      const item =
        new Warehouse(req.body);

      await item.save();

      res.json(item);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= UPDATE =================

exports.updateWarehouseItem =
  async (req, res) => {
    try {

      const item =
        await Warehouse.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true }
        );

      res.json(item);

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };


// ================= DELETE =================

exports.deleteWarehouseItem =
  async (req, res) => {
    try {

      await Warehouse.findByIdAndDelete(
        req.params.id
      );

      res.json({
        message:
          "Warehouse item deleted",
      });

    } catch (err) {
      res.status(500).json({
        error: err.message,
      });
    }
  };
