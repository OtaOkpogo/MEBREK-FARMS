const router = require("express").Router();

const { protect: auth, allowRoles } = require("../middleware/authMiddleware");

const {
  createExpense,
  getExpenses,
  deleteExpense,
  getExpenseStats,
} = require("../controllers/expenseController");

// SUPERADMIN ONLY — matches Workers' access level and the App.jsx
// route restriction. Previously these routes only checked
// authentication (any logged-in role), not role — meaning any staff
// or manager account could hit /api/expenses directly regardless of
// what the sidebar/frontend routes hid from them.

router.post("/", auth, allowRoles("superadmin"), createExpense);
router.get("/", auth, allowRoles("superadmin"), getExpenses);
router.get("/stats", auth, allowRoles("superadmin"), getExpenseStats);
router.delete("/:id", auth, allowRoles("superadmin"), deleteExpense);

module.exports = router;
