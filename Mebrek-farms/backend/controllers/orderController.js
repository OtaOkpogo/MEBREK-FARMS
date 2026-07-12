const Order = require("../models/Order");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { name, contact, message } = req.body;

    const order = await Order.create({
      name,
      contact,
      message,
    });

    // Emit socket event
    const io = req.app.get("io");

    if (io) {
      io.emit("newOrder", order);
      console.log("📦 New order emitted:", order.name);
    }

    res.status(201).json({
      message: "Order submitted successfully",
      order,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
};

// Get All Orders (Admin)
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
};
