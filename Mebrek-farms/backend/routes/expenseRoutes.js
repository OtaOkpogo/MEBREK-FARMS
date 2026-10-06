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
} = require("../controllers/expenseController");

// ============================================================
// CREATE
// ============================================================

router.post("/", auth, allowRoles("superadmin"), createExpense);

// ============================================================
// ACTIVE EXPENSES
// ============================================================

router.get("/", auth, allowRoles("superadmin"), getExpenses);

// ============================================================
// BASIC STATS
// ============================================================

router.get("/stats", auth, allowRoles("superadmin"), getExpenseStats);

// ============================================================
// SERVER-SIDE FINANCIAL REPORT
// IMPORTANT: Must come before /:id
// ============================================================

router.get("/report", auth, allowRoles("superadmin"), getExpenseReport);

// ============================================================
// DELETED EXPENSES
// ============================================================

router.get("/deleted", auth, allowRoles("superadmin"), getDeletedExpenses);

// ============================================================
// UPDATE
// ============================================================

router.put("/:id", auth, allowRoles("superadmin"), updateExpense);

// ============================================================
// SOFT DELETE
// ============================================================

router.delete("/:id", auth, allowRoles("superadmin"), deleteExpense);

// ============================================================
// RESTORE
// ============================================================

router.patch("/:id/restore", auth, allowRoles("superadmin"), restoreExpense);

module.exports = router;
