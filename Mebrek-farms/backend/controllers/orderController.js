const Order = require("../models/Order");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    const order = new Order({
      name,
      email,
      message,
    });

    await order.save();

    res.status(201).json({
      message: "Order submitted successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get All Orders (Admin)
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
