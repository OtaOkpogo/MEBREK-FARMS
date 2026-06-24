const router = require("express").Router();

const auth = require("../middleware/authMiddleware");

const {
  createExpense,
  getExpenses,
  deleteExpense,
  getExpenseStats,
} = require("../controllers/expenseController");

router.post("/", auth, createExpense);
router.get("/", auth, getExpenses);
router.get("/stats", auth, getExpenseStats);
router.delete("/:id", auth, deleteExpense);

module.exports = router;
