const router = require("express").Router();

const { protect: auth, allowRoles } = require("../middleware/authMiddleware");

const {
  createExpense,
  getExpenses,
  getDeletedExpenses,
  updateExpense,
  deleteExpense,
  restoreExpense,
  getExpenseStats,
  getExpenseReport,
  getPayrollWorkers,
  setPayrollSalary,
  createSalaryPayment,
  createBulkSalaryPayments,
} = require("../controllers/expenseController");

// ============================================================
// MONTHLY PAYROLL
// All payroll endpoints are superadmin-only.
// Register these routes before any /:id routes.
// ============================================================

// Load workers, agreed salaries, payments, and outstanding balances.
router.get(
  "/payroll/workers",
  auth,
  allowRoles("superadmin"),
  getPayrollWorkers,
);

// Set or update a worker's agreed salary for a particular month.
router.post(
  "/payroll/salary",
  auth,
  allowRoles("superadmin"),
  setPayrollSalary,
);

// Record an individual salary payment.
router.post(
  "/payroll/payment",
  auth,
  allowRoles("superadmin"),
  createSalaryPayment,
);

// Record payments for multiple selected workers.
router.post(
  "/payroll/bulk",
  auth,
  allowRoles("superadmin"),
  createBulkSalaryPayments,
);

// ============================================================
// GENERAL EXPENSES
// ============================================================

// Create an expense.
router.post("/", auth, allowRoles("superadmin"), createExpense);

// Get active expenses.
router.get("/", auth, allowRoles("superadmin"), getExpenses);

// Basic expense statistics.
router.get("/stats", auth, allowRoles("superadmin"), getExpenseStats);

// Financial report.
router.get("/report", auth, allowRoles("superadmin"), getExpenseReport);

// Get deleted expenses.
router.get("/deleted", auth, allowRoles("superadmin"), getDeletedExpenses);

// Update an expense.
router.put("/:id", auth, allowRoles("superadmin"), updateExpense);

// Soft-delete an expense.
router.delete("/:id", auth, allowRoles("superadmin"), deleteExpense);

// Restore a deleted expense.
router.patch("/:id/restore", auth, allowRoles("superadmin"), restoreExpense);

module.exports = router;
