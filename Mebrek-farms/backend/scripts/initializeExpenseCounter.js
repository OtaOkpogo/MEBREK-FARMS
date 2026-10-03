require("dotenv").config();

const mongoose = require("mongoose");

const Expense = require("../models/Expense");
const Counter = require("../models/Counter");

const initializeExpenseCounter = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected.");

    const year = new Date().getFullYear();
    const prefix = `EXP-${year}-`;

    const expenses = await Expense.find({
      expenseNumber: {
        $regex: `^${prefix}`,
      },
    })
      .select("expenseNumber")
      .lean();

    let maxSequence = 0;

    for (const expense of expenses) {
      if (!expense.expenseNumber) continue;

      const sequence = Number(
        expense.expenseNumber.replace(prefix, "")
      );

      if (Number.isFinite(sequence) && sequence > maxSequence) {
        maxSequence = sequence;
      }
    }

    await Counter.findOneAndUpdate(
      {
        _id: `expense-${year}`,
      },
      {
        $set: {
          seq: maxSequence,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(
      `Expense counter initialized for ${year}: ${maxSequence}`
    );

    console.log(
      `Next expense number will be EXP-${year}-${String(
        maxSequence + 1
      ).padStart(6, "0")}`
    );
  } catch (error) {
    console.error("Failed to initialize expense counter:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

initializeExpenseCounter();
