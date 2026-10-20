require("dotenv").config();

const mongoose = require("mongoose");
const Order = require("./models/Order");
const OrderCounter = require("./models/OrderCounter");

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from your backend .env file");
  }

  await mongoose.connect(process.env.MONGO_URI);

  // Include every unnumbered order, not only website orders.
  // Existing assigned booking numbers are never changed.
  const missingCount = await Order.countDocuments({
    $or: [
      { bookingNumber: { $exists: false } },
      { bookingNumber: null },
    ],
  });

  const existingMax = await Order.findOne({
    bookingNumber: { $exists: true, $ne: null },
  })
    .sort({ bookingNumber: -1 })
    .select("bookingNumber")
    .lean();

  const counter = await OrderCounter.findById("orders").lean();

  const currentCounter = Number(counter?.sequence || 0);
  const highestAssigned = Number(existingMax?.bookingNumber || 0);
  const startingSequence = Math.max(currentCounter, highestAssigned);

  console.log("Unnumbered orders:", missingCount);
  console.log("Highest existing booking number:", highestAssigned);
  console.log("Current counter sequence:", currentCounter);
  console.log("Next number to assign:", startingSequence + 1);

  if (missingCount === 0) {
    // Keep the counter in sync even if all records already have numbers.
    await OrderCounter.findOneAndUpdate(
      { _id: "orders" },
      { $max: { sequence: highestAssigned } },
      { upsert: true, new: true },
    );
    console.log("No unnumbered orders need updating.");
    return;
  }

  console.log("Assigning permanent numbers to unnumbered orders...");

  // Oldest orders first; _id is a stable tie-breaker.
  const orders = await Order.find({
    $or: [
      { bookingNumber: { $exists: false } },
      { bookingNumber: null },
    ],
  })
    .sort({ bookingAt: 1, createdAt: 1, _id: 1 })
    .select("_id name source bookingAt")
    .lean();

  let sequence = startingSequence;

  for (const order of orders) {
    sequence += 1;

    // Atomic condition prevents overwriting a number if another process
    // assigned one after this migration read the record.
    const result = await Order.updateOne(
      {
        _id: order._id,
        $or: [
          { bookingNumber: { $exists: false } },
          { bookingNumber: null },
        ],
      },
      { $set: { bookingNumber: sequence } },
    );

    if (result.modifiedCount === 1) {
      console.log(
        `Assigned MF-${String(sequence).padStart(5, "0")} to ${order.source || "Unknown"} order: ${order.name}`,
      );
    } else {
      console.log(`Skipped order ${order._id}; it was already updated.`);
    }
  }

  // Never allow the counter to trail behind assigned numbers.
  const finalMax = await Order.findOne({
    bookingNumber: { $exists: true, $ne: null },
  })
    .sort({ bookingNumber: -1 })
    .select("bookingNumber")
    .lean();

  await OrderCounter.findOneAndUpdate(
    { _id: "orders" },
    { $max: { sequence: Number(finalMax?.bookingNumber || 0) } },
    { upsert: true, new: true },
  );

  const remaining = await Order.countDocuments({
    $or: [
      { bookingNumber: { $exists: false } },
      { bookingNumber: null },
    ],
  });

  console.log("Migration finished.");
  console.log("Orders still missing numbers:", remaining);
  console.log("Counter synchronized to:", finalMax?.bookingNumber || 0);
}

main()
  .catch((error) => {
    console.error("BOOKING NUMBER MIGRATION FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
