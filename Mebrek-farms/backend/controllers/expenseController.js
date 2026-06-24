const Expense = require("../models/Expense");

// CREATE EXPENSE
exports.createExpense = async (req, res) => {
  try {
    const { quantity, unitCost } = req.body;

    const amount =
      req.body.amount ||
      Number(quantity || 0) * Number(unitCost || 0);

    const expense = await Expense.create({
      ...req.body,
      amount,
    });

    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET ALL EXPENSES
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE EXPENSE
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: "Not found" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// STATS (FOR DASHBOARD)
exports.getExpenseStats = async (req, res) => {
  try {
    const total = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const category = await Expense.aggregate([
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]);

    res.json({
      totalExpenses: total[0]?.total || 0,
      categoryBreakdown: category,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
