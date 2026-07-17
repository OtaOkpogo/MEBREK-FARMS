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

// Update Order Status (Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = ["Pending", "Contacted", "Completed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    order.status = status;
    await order.save();

    // Let the admin panel update in real time if another admin has
    // the Orders page open, matching the newOrder socket pattern.
    const io = req.app.get("io");

    if (io) {
      io.emit("orderStatusUpdated", order);
    }

    res.json(order);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
};
// Delete Order
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        error: "Order not found",
      });
    }

    await Order.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");

    if (io) {
      io.emit("orderDeleted", {
        id: req.params.id,
      });
    }

    res.json({
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
};
