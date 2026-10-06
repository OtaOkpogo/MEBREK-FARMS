import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchDeletedExpenses,
  restoreExpense,
  fetchExpenseReport,
} from "../services/expenseService";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 10;

const CATEGORIES = [
  "Feed",
  "Drugs",
  "Labour",
  "Fuel",
  "Repairs",
  "Utilities",
  "Transport",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Transfer", "POS"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const initialForm = {
  date: new Date().toISOString().split("T")[0],
  category: "Feed",
  description: "",
  quantity: 1,
  unitCost: "",
  supplier: "",
  paymentMethod: "Cash",
  remarks: "",
};

const initialFilters = {
  search: "",
  category: "All",
  paymentMethod: "All",
  startDate: "",
  endDate: "",
};

const emptyReport = {
  filters: {},

  summary: {
    totalExpenses: 0,
    totalAmount: 0,
    averageExpense: 0,
    largestExpense: 0,
  },

  dailyTrend: [],
  monthlyTrend: [],
  yearlyTrend: [],

  categoryBreakdown: [],
  paymentMethodBreakdown: [],
};

// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("en-NG");
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getExpenseId = (expense) => {
  return expense?._id || expense?.id;
};

const getCreatedByName = (expense) => {
  return expense?.createdByName || expense?.createdBy?.name || "Unknown";
};

const getUpdatedByName = (expense) => {
  return expense?.updatedByName || expense?.updatedBy?.name || "—";
};

const getDeletedByName = (expense) => {
  return expense?.deletedByName || expense?.deletedBy?.name || "—";
};

// ============================================================
// BUILD JANUARY - DECEMBER CHART DATA
// ============================================================

const buildMonthlyChartData = (monthlyTrend) => {
  const source = Array.isArray(monthlyTrend) ? monthlyTrend : [];

  const currentYear = new Date().getFullYear();

  /*
   * Expected backend format:
   *
   * {
   *   year: 2026,
   *   month: 1,
   *   totalAmount: 350000,
   *   count: 5
   * }
   *
   * The function also supports:
   *
   * {
   *   label: "2026-01",
   *   totalAmount: 350000
   * }
   */

  const years = source
    .map((item) => Number(item?.year))
    .filter((year) => Number.isFinite(year));

  const selectedYear = years.length > 0 ? Math.max(...years) : currentYear;

  return MONTHS.map((monthName, index) => {
    const monthNumber = index + 1;

    const matchingRows = source.filter((item) => {
      const itemMonth = Number(item?.month);
      const itemYear = Number(item?.year);

      // Preferred backend format
      if (Number.isFinite(itemYear) && Number.isFinite(itemMonth)) {
        return itemYear === selectedYear && itemMonth === monthNumber;
      }

      // Fallback for labels such as 2026-01
      const label = String(item?.label || "");

      const expectedLabel = `${selectedYear}-${String(monthNumber).padStart(2, "0")}`;

      return label === expectedLabel;
    });

    const totalAmount = matchingRows.reduce((sum, item) => {
      return sum + Number(item?.totalAmount || 0);
    }, 0);

    const count = matchingRows.reduce((sum, item) => {
      return sum + Number(item?.count || 0);
    }, 0);

    return {
      month: monthName,
      monthShort: monthName.substring(0, 3),
      totalAmount,
      count,
    };
  });
};

// ============================================================
// COMPONENT
// ============================================================

export default function Expenses() {
  // ==========================================================
  // DATA
  // ==========================================================

  const [expenses, setExpenses] = useState([]);
  const [deletedExpenses, setDeletedExpenses] = useState([]);

  // ==========================================================
  // LOADING / ACTION STATES
  // ==========================================================

  const [loading, setLoading] = useState(true);

  const [deletedLoading, setDeletedLoading] = useState(false);

  const [reportLoading, setReportLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const [actionId, setActionId] = useState(null);

  // ==========================================================
  // UI STATE
  // ==========================================================

  const [activeTab, setActiveTab] = useState("active");

  const [editingId, setEditingId] = useState(null);

  const [selectedExpense, setSelectedExpense] = useState(null);

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const [currentPage, setCurrentPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    totalRecords: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // ==========================================================
  // FORM
  // ==========================================================

  const [formData, setFormData] = useState(initialForm);

  // ==========================================================
  // FILTERS
  // ==========================================================

  const [filters, setFilters] = useState(initialFilters);

  // ==========================================================
  // SERVER-SIDE REPORT
  // ==========================================================

  const [expenseReport, setExpenseReport] = useState(emptyReport);

  // ==========================================================
  // MONTHLY CHART DATA
  // ==========================================================

  const monthlyChartData = useMemo(() => {
    return buildMonthlyChartData(expenseReport.monthlyTrend);
  }, [expenseReport.monthlyTrend]);

  const chartTotal = useMemo(() => {
    return monthlyChartData.reduce((sum, item) => {
      return sum + Number(item.totalAmount || 0);
    }, 0);
  }, [monthlyChartData]);

  const chartYear = useMemo(() => {
    const monthlyTrend = Array.isArray(expenseReport.monthlyTrend)
      ? expenseReport.monthlyTrend
      : [];

    const years = monthlyTrend
      .map((item) => Number(item?.year))
      .filter((year) => Number.isFinite(year));

    if (years.length > 0) {
      return Math.max(...years);
    }

    return new Date().getFullYear();
  }, [expenseReport.monthlyTrend]);

  // ==========================================================
  // LOAD ACTIVE EXPENSES
  // ==========================================================

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetchExpenses({
        page: currentPage,
        limit: PAGE_SIZE,
        search: filters.search,
        category: filters.category,
        paymentMethod: filters.paymentMethod,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const data = response || {};

      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);

      setPagination(
        data.pagination || {
          page: currentPage,
          limit: PAGE_SIZE,
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      );

      if (data.pagination?.page && data.pagination.page !== currentPage) {
        setCurrentPage(data.pagination.page);
      }
    } catch (error) {
      console.error("LOAD EXPENSES ERROR:", error);

      toast.error(error?.response?.data?.message || "Failed to load expenses.");

      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    filters.search,
    filters.category,
    filters.paymentMethod,
    filters.startDate,
    filters.endDate,
  ]);

  // ==========================================================
  // LOAD DELETED EXPENSES
  // ==========================================================

  const loadDeletedExpenses = useCallback(async () => {
    try {
      setDeletedLoading(true);

      const data = await fetchDeletedExpenses();

      setDeletedExpenses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("LOAD DELETED EXPENSES ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to load deleted expenses.",
      );

      setDeletedExpenses([]);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  // ==========================================================
  // LOAD SERVER-SIDE REPORT
  // ==========================================================

  const loadExpenseReport = useCallback(async () => {
    try {
      setReportLoading(true);

      const report = await fetchExpenseReport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        paymentMethod: filters.paymentMethod,
      });

      setExpenseReport({
        filters: report?.filters || {},

        summary: {
          totalExpenses: report?.summary?.totalExpenses || 0,

          totalAmount: report?.summary?.totalAmount || 0,

          averageExpense: report?.summary?.averageExpense || 0,

          largestExpense: report?.summary?.largestExpense || 0,
        },

        dailyTrend: Array.isArray(report?.dailyTrend) ? report.dailyTrend : [],

        monthlyTrend: Array.isArray(report?.monthlyTrend)
          ? report.monthlyTrend
          : [],

        yearlyTrend: Array.isArray(report?.yearlyTrend)
          ? report.yearlyTrend
          : [],

        categoryBreakdown: Array.isArray(report?.categoryBreakdown)
          ? report.categoryBreakdown
          : [],

        paymentMethodBreakdown: Array.isArray(report?.paymentMethodBreakdown)
          ? report.paymentMethodBreakdown
          : [],
      });
    } catch (error) {
      console.error("LOAD EXPENSE REPORT ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to load expense report.",
      );

      setExpenseReport(emptyReport);
    } finally {
      setReportLoading(false);
    }
  }, [
    filters.startDate,
    filters.endDate,
    filters.category,
    filters.paymentMethod,
  ]);

  // ==========================================================
  // EFFECTS
  // ==========================================================

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    loadExpenseReport();
  }, [loadExpenseReport]);

  useEffect(() => {
    if (activeTab === "deleted") {
      loadDeletedExpenses();
    }
  }, [activeTab, loadDeletedExpenses]);

  // ==========================================================
  // FORM HANDLERS
  // ==========================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((previous) => ({
      ...previous,
      [name]: value,
    }));

    setCurrentPage(1);
  };

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(1);
  };

  // ==========================================================
  // FORM SUBMIT
  // ==========================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.date) {
      toast.error("Please select an expense date.");
      return;
    }

    if (!formData.category) {
      toast.error("Please select an expense category.");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter an expense description.");
      return;
    }

    const quantity = Number(formData.quantity);

    const unitCost = Number(formData.unitCost);

    if (!Number.isFinite(quantity) || quantity < 0) {
      toast.error("Quantity must be a valid non-negative number.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      toast.error("Unit cost must be a valid non-negative number.");
      return;
    }

    const payload = {
      date: formData.date,
      category: formData.category,
      description: formData.description.trim(),
      quantity,
      unitCost,
      supplier: formData.supplier.trim(),
      paymentMethod: formData.paymentMethod,
      remarks: formData.remarks.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateExpense(editingId, payload);

        toast.success("Expense updated successfully.");
      } else {
        await createExpense(payload);

        toast.success("Expense created successfully.");
      }

      resetForm();
      setCurrentPage(1);

      await Promise.all([loadExpenses(), loadExpenseReport()]);
    } catch (error) {
      console.error("SAVE EXPENSE ERROR:", error);

      toast.error(error?.response?.data?.message || "Failed to save expense.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================
  // EDIT
  // ==========================================================

  const handleEdit = (expense) => {
    setEditingId(getExpenseId(expense));

    setFormData({
      date: expense?.date
        ? new Date(expense.date).toISOString().split("T")[0]
        : initialForm.date,

      category: expense?.category || "Feed",

      description: expense?.description || "",

      quantity: expense?.quantity ?? 1,

      unitCost: expense?.unitCost ?? "",

      supplier: expense?.supplier || "",

      paymentMethod: expense?.paymentMethod || "Cash",

      remarks: expense?.remarks || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==========================================================
  // DELETE
  // ==========================================================

  const handleDelete = async (expense) => {
    const id = getExpenseId(expense);

    if (!id) {
      toast.error("Unable to determine expense ID.");
      return;
    }

    const confirmed = window.confirm(
      `Delete expense ${
        expense?.expenseNumber || "record"
      }?\n\nThis will move the expense to deleted records and preserve its audit history.`,
    );

    if (!confirmed) return;

    try {
      setActionId(id);

      await deleteExpense(id);

      toast.success("Expense deleted successfully.");

      await Promise.all([loadExpenses(), loadExpenseReport()]);

      if (activeTab === "deleted") {
        await loadDeletedExpenses();
      }
    } catch (error) {
      console.error("DELETE EXPENSE ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to delete expense.",
      );
    } finally {
      setActionId(null);
    }
  };

  // ==========================================================
  // RESTORE
  // ==========================================================

  const handleRestore = async (expense) => {
    const id = getExpenseId(expense);

    if (!id) {
      toast.error("Unable to determine expense ID.");
      return;
    }

    const confirmed = window.confirm(
      `Restore ${expense?.expenseNumber || "this expense"}?`,
    );

    if (!confirmed) return;

    try {
      setActionId(id);

      await restoreExpense(id);

      toast.success("Expense restored successfully.");

      await Promise.all([
        loadExpenses(),
        loadDeletedExpenses(),
        loadExpenseReport(),
      ]);
    } catch (error) {
      console.error("RESTORE EXPENSE ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to restore expense.",
      );
    } finally {
      setActionId(null);
    }
  };

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const goToPage = (page) => {
    if (
      page < 1 ||
      (pagination.totalPages > 0 && page > pagination.totalPages)
    ) {
      return;
    }

    setCurrentPage(page);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const pageNumbers = useMemo(() => {
    const totalPages = pagination.totalPages || 0;

    if (totalPages <= 1) {
      return [];
    }

    const pages = [];

    let start = Math.max(1, currentPage - 2);

    let end = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
      start = 1;
      end = Math.min(5, totalPages);
    }

    if (currentPage >= totalPages - 2) {
      start = Math.max(1, totalPages - 4);

      end = totalPages;
    }

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    return pages;
  }, [currentPage, pagination.totalPages]);

  // ==========================================================
  // EXPORT CURRENT PAGE TO EXCEL
  // ==========================================================

  const exportExpensesToExcel = () => {
    if (!expenses.length) {
      toast.info("There are no expenses on the current page to export.");
      return;
    }

    const rows = expenses.map((expense) => ({
      "Expense Number": expense?.expenseNumber || "",

      Date: formatDate(expense?.date),

      Category: expense?.category || "",

      Description: expense?.description || "",

      Quantity: expense?.quantity ?? 0,

      "Unit Cost": expense?.unitCost ?? 0,

      Amount: expense?.amount ?? 0,

      Supplier: expense?.supplier || "",

      "Payment Method": expense?.paymentMethod || "",

      "Created By": getCreatedByName(expense),

      "Updated By": getUpdatedByName(expense),

      Remarks: expense?.remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

    XLSX.writeFile(workbook, `expenses-page-${currentPage}.xlsx`);

    toast.success("Current expense page exported to Excel.");
  };

  // ==========================================================
  // EXPORT REPORT TO EXCEL
  // ==========================================================

  const exportReportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      {
        Metric: "Total Expenses",
        Value: expenseReport.summary.totalExpenses,
      },
      {
        Metric: "Total Amount",
        Value: expenseReport.summary.totalAmount,
      },
      {
        Metric: "Average Expense",
        Value: expenseReport.summary.averageExpense,
      },
      {
        Metric: "Largest Expense",
        Value: expenseReport.summary.largestExpense,
      },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summaryRows),
      "Summary",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        expenseReport.dailyTrend.map((item) => ({
          Date: item.date,
          Expenses: item.count || 0,
          Total: item.totalAmount || 0,
        })),
      ),
      "Daily",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        expenseReport.monthlyTrend.map((item) => ({
          Year: item.year || "",
          Month: item.month || "",
          Label: item.label || "",
          Expenses: item.count || 0,
          Total: item.totalAmount || 0,
        })),
      ),
      "Monthly",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        expenseReport.yearlyTrend.map((item) => ({
          Year: item.year,
          Expenses: item.count || 0,
          Total: item.totalAmount || 0,
        })),
      ),
      "Yearly",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        expenseReport.categoryBreakdown.map((item) => ({
          Category: item.category || item._id || "",
          Expenses: item.count || 0,
          Total: item.totalAmount || 0,
        })),
      ),
      "Categories",
    );

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        expenseReport.paymentMethodBreakdown.map((item) => ({
          "Payment Method": item.paymentMethod || item._id || "",
          Expenses: item.count || 0,
          Total: item.totalAmount || 0,
        })),
      ),
      "Payments",
    );

    XLSX.writeFile(workbook, "expense-financial-report.xlsx");

    toast.success("Financial expense report exported to Excel.");
  };

  // ==========================================================
  // EXPORT REPORT TO PDF
  // ==========================================================

  const exportReportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);

    doc.text("Mebrek Farms - Expense Financial Report", 14, 18);

    doc.setFontSize(10);

    doc.text(`Generated: ${formatDateTime(new Date())}`, 14, 26);

    let yPosition = 34;

    autoTable(doc, {
      startY: yPosition,

      head: [["Metric", "Value"]],

      body: [
        ["Total Expenses", formatNumber(expenseReport.summary.totalExpenses)],
        ["Total Amount", formatCurrency(expenseReport.summary.totalAmount)],
        [
          "Average Expense",
          formatCurrency(expenseReport.summary.averageExpense),
        ],
        [
          "Largest Expense",
          formatCurrency(expenseReport.summary.largestExpense),
        ],
      ],
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(14);

    doc.text("Daily Expenses", 14, yPosition);

    yPosition += 4;

    autoTable(doc, {
      startY: yPosition,

      head: [["Date", "Expenses", "Total"]],

      body: expenseReport.dailyTrend.map((item) => [
        item.date,
        formatNumber(item.count),
        formatCurrency(item.totalAmount),
      ]),
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(14);

    doc.text("Monthly Expenses", 14, yPosition);

    yPosition += 4;

    autoTable(doc, {
      startY: yPosition,

      head: [["Month", "Expenses", "Total"]],

      body: expenseReport.monthlyTrend.map((item) => [
        item.label || `${item.year}-${item.month}`,
        formatNumber(item.count),
        formatCurrency(item.totalAmount),
      ]),
    });

    yPosition = doc.lastAutoTable.finalY + 10;

    doc.setFontSize(14);

    doc.text("Yearly Expenses", 14, yPosition);

    yPosition += 4;

    autoTable(doc, {
      startY: yPosition,

      head: [["Year", "Expenses", "Total"]],

      body: expenseReport.yearlyTrend.map((item) => [
        String(item.year),
        formatNumber(item.count),
        formatCurrency(item.totalAmount),
      ]),
    });

    doc.save("expense-financial-report.pdf");

    toast.success("Financial expense report exported to PDF.");
  };

  // ==========================================================
  // FORM TOTAL
  // ==========================================================

  const formAmount = useMemo(() => {
    const quantity = Number(formData.quantity || 0);

    const unitCost = Number(formData.unitCost || 0);

    return quantity * unitCost;
  }, [formData.quantity, formData.unitCost]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Expenses
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Manage farm expenses, financial records, audit history and expense
            reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExpensesToExcel}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          >
            Export Current Page
          </button>

          <button
            type="button"
            onClick={exportReportToExcel}
            disabled={reportLoading}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Export Report Excel
          </button>

          <button
            type="button"
            onClick={exportReportToPDF}
            disabled={reportLoading}
            className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            Export Report PDF
          </button>
        </div>
      </div>

      {/* ================================================== */}
      {/* FORM */}
      {/* ================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? "Edit Expense" : "Record New Expense"}
            </h2>

            <p className="text-sm text-gray-500">
              Amount is calculated automatically from quantity × unit cost.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>

            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>

            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
              required
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>

            <input
              type="text"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="e.g. 20 bags of layer feed"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>

            <input
              type="number"
              name="quantity"
              min="0"
              step="0.01"
              value={formData.quantity}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Cost
            </label>

            <input
              type="number"
              name="unitCost"
              min="0"
              step="0.01"
              value={formData.unitCost}
              onChange={handleChange}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>

            <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-900">
              {formatCurrency(formAmount)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier
            </label>

            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Supplier name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>

            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>

            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              placeholder="Optional remarks"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Expense"
                  : "Save Expense"}
            </button>
          </div>
        </form>
      </div>

      {/* ================================================== */}
      {/* SUMMARY */}
      {/* ================================================== */}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Financial Summary
            </h2>

            <p className="text-sm text-gray-500">
              Server-side totals across all matching active expenses.
            </p>
          </div>

          {reportLoading && (
            <span className="text-sm text-gray-500">Updating report...</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Total Expenses</p>

            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatNumber(expenseReport.summary.totalExpenses)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Total Amount</p>

            <p className="text-2xl font-bold text-green-700 mt-1">
              {formatCurrency(expenseReport.summary.totalAmount)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Average Expense</p>

            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(expenseReport.summary.averageExpense)}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-sm text-gray-500">Largest Expense</p>

            <p className="text-2xl font-bold text-red-700 mt-1">
              {formatCurrency(expenseReport.summary.largestExpense)}
            </p>
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* FILTERS */}
      {/* ================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Expense Filters
            </h2>

            <p className="text-sm text-gray-500">
              Filters affect the expense table and financial reports.
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>

            <input
              type="text"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Reference, description, supplier..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>

            <select
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="All">All Categories</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment
            </label>

            <select
              name="paymentMethod"
              value={filters.paymentMethod}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
            >
              <option value="All">All Payments</option>

              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From
            </label>

            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To
            </label>

            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* JANUARY - DECEMBER EXPENDITURE CHART */}
      {/* ================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              January–December Expenditure
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Monthly expenditure for{" "}
              <span className="font-medium text-gray-700">{chartYear}</span>.
              Months with no expenditure are shown as ₦0.
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">Chart Total</p>

            <p className="text-xl font-bold text-green-700">
              {formatCurrency(chartTotal)}
            </p>
          </div>
        </div>

        {reportLoading ? (
          <div className="h-[360px] flex items-center justify-center text-gray-500">
            Loading expenditure chart...
          </div>
        ) : (
          <div className="w-full h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartData}
                margin={{
                  top: 10,
                  right: 20,
                  left: 10,
                  bottom: 10,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  dataKey="monthShort"
                  tick={{
                    fontSize: 12,
                  }}
                />

                <YAxis
                  tickFormatter={(value) => {
                    const amount = Number(value || 0);

                    return `₦${amount.toLocaleString("en-NG", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    })}`;
                  }}
                />

                <Tooltip
                  formatter={(value) => {
                    return [formatCurrency(value), "Expenditure"];
                  }}
                  labelFormatter={(label) => {
                    return `${label} ${chartYear}`;
                  }}
                />

                <Bar
                  dataKey="totalAmount"
                  name="Expenditure"
                  fill="#16a34a"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 12 MONTH VALUES */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
          {monthlyChartData.map((item) => (
            <div
              key={item.month}
              className="rounded-lg bg-gray-50 border border-gray-100 p-2 text-center"
            >
              <p className="text-xs text-gray-500">{item.monthShort}</p>

              <p className="text-xs font-semibold text-gray-800 mt-1">
                {formatCurrency(item.totalAmount)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================== */}
      {/* DAILY / MONTHLY / YEARLY REPORTS */}
      {/* ================================================== */}

      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Expense Trends
          </h2>

          <p className="text-sm text-gray-500">
            Daily, monthly and yearly expense totals from the complete
            server-side report.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* DAILY */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Daily Expenses
                </h3>

                <p className="text-sm text-gray-500">By day</p>
              </div>

              {reportLoading && (
                <span className="text-xs text-gray-500">Loading...</span>
              )}
            </div>

            {expenseReport.dailyTrend.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                No daily expense data available.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2">Date</th>

                      <th className="text-right py-2 px-2">Count</th>

                      <th className="text-right py-2 px-2">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenseReport.dailyTrend.map((item) => (
                      <tr key={item.date} className="border-b border-gray-100">
                        <td className="py-2 px-2 whitespace-nowrap">
                          {formatDate(item.date)}
                        </td>

                        <td className="py-2 px-2 text-right">
                          {formatNumber(item.count)}
                        </td>

                        <td className="py-2 px-2 text-right font-medium whitespace-nowrap">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* MONTHLY */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Monthly Expenses
                </h3>

                <p className="text-sm text-gray-500">By month</p>
              </div>

              {reportLoading && (
                <span className="text-xs text-gray-500">Loading...</span>
              )}
            </div>

            {expenseReport.monthlyTrend.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                No monthly expense data available.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2">Month</th>

                      <th className="text-right py-2 px-2">Count</th>

                      <th className="text-right py-2 px-2">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenseReport.monthlyTrend.map((item, index) => (
                      <tr
                        key={
                          item.label || `${item.year}-${item.month}-${index}`
                        }
                        className="border-b border-gray-100"
                      >
                        <td className="py-2 px-2 whitespace-nowrap">
                          {item.label || `${item.year}-${item.month}`}
                        </td>

                        <td className="py-2 px-2 text-right">
                          {formatNumber(item.count)}
                        </td>

                        <td className="py-2 px-2 text-right font-medium whitespace-nowrap">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* YEARLY */}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Yearly Expenses
                </h3>

                <p className="text-sm text-gray-500">By year</p>
              </div>

              {reportLoading && (
                <span className="text-xs text-gray-500">Loading...</span>
              )}
            </div>

            {expenseReport.yearlyTrend.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-sm">
                No yearly expense data available.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2">Year</th>

                      <th className="text-right py-2 px-2">Count</th>

                      <th className="text-right py-2 px-2">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenseReport.yearlyTrend.map((item) => (
                      <tr key={item.year} className="border-b border-gray-100">
                        <td className="py-2 px-2">{item.year}</td>

                        <td className="py-2 px-2 text-right">
                          {formatNumber(item.count)}
                        </td>

                        <td className="py-2 px-2 text-right font-medium whitespace-nowrap">
                          {formatCurrency(item.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* CATEGORY / PAYMENT BREAKDOWN */}
      {/* ================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CATEGORY */}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            Expense by Category
          </h3>

          <p className="text-sm text-gray-500 mb-4">
            Total active expenses by category.
          </p>

          {expenseReport.categoryBreakdown.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              No category data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2">Category</th>

                    <th className="text-right py-2 px-2">Count</th>

                    <th className="text-right py-2 px-2">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {expenseReport.categoryBreakdown.map((item) => (
                    <tr
                      key={item.category || item._id}
                      className="border-b border-gray-100"
                    >
                      <td className="py-2 px-2">
                        {item.category || item._id || "Other"}
                      </td>

                      <td className="py-2 px-2 text-right">
                        {formatNumber(item.count)}
                      </td>

                      <td className="py-2 px-2 text-right font-medium">
                        {formatCurrency(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAYMENT */}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            Expense by Payment Method
          </h3>

          <p className="text-sm text-gray-500 mb-4">
            Total active expenses by payment method.
          </p>

          {expenseReport.paymentMethodBreakdown.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              No payment data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2">Payment Method</th>

                    <th className="text-right py-2 px-2">Count</th>

                    <th className="text-right py-2 px-2">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {expenseReport.paymentMethodBreakdown.map((item) => (
                    <tr
                      key={item.paymentMethod || item._id}
                      className="border-b border-gray-100"
                    >
                      <td className="py-2 px-2">
                        {item.paymentMethod || item._id || "Unknown"}
                      </td>

                      <td className="py-2 px-2 text-right">
                        {formatNumber(item.count)}
                      </td>

                      <td className="py-2 px-2 text-right font-medium">
                        {formatCurrency(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================================================== */}
      {/* ACTIVE / DELETED TABS */}
      {/* ================================================== */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 px-5 pt-5">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className={`pb-3 border-b-2 font-medium ${
                activeTab === "active"
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Active Expenses
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deleted")}
              className={`pb-3 border-b-2 font-medium ${
                activeTab === "deleted"
                  ? "border-red-600 text-red-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Deleted Expenses
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* ACTIVE TABLE */}
        {/* ================================================== */}

        {activeTab === "active" && (
          <div className="p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Expense Records
                </h2>

                <p className="text-sm text-gray-500">
                  Showing {expenses.length} of{" "}
                  {formatNumber(pagination.totalRecords)} matching records.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  loadExpenses();
                  loadExpenseReport();
                }}
                disabled={loading || reportLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-500">
                Loading expenses...
              </div>
            ) : expenses.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-gray-500">No expenses found.</p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 text-green-600 hover:text-green-700 font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-3">Reference</th>

                        <th className="text-left px-3 py-3">Date</th>

                        <th className="text-left px-3 py-3">Category</th>

                        <th className="text-left px-3 py-3">Description</th>

                        <th className="text-right px-3 py-3">Qty</th>

                        <th className="text-right px-3 py-3">Unit Cost</th>

                        <th className="text-right px-3 py-3">Amount</th>

                        <th className="text-left px-3 py-3">Supplier</th>

                        <th className="text-left px-3 py-3">Payment</th>

                        <th className="text-left px-3 py-3">Created By</th>

                        <th className="text-right px-3 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {expenses.map((expense) => {
                        const id = getExpenseId(expense);

                        return (
                          <tr
                            key={id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-3 py-3 font-medium text-green-700 whitespace-nowrap">
                              {expense?.expenseNumber || "—"}
                            </td>

                            <td className="px-3 py-3 whitespace-nowrap">
                              {formatDate(expense?.date)}
                            </td>

                            <td className="px-3 py-3">
                              {expense?.category || "—"}
                            </td>

                            <td className="px-3 py-3 min-w-[220px]">
                              <div className="font-medium text-gray-900">
                                {expense?.description || "—"}
                              </div>

                              {expense?.remarks && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {expense.remarks}
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {formatNumber(expense?.quantity)}
                            </td>

                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              {formatCurrency(expense?.unitCost)}
                            </td>

                            <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                              {formatCurrency(expense?.amount)}
                            </td>

                            <td className="px-3 py-3">
                              {expense?.supplier || "—"}
                            </td>

                            <td className="px-3 py-3">
                              {expense?.paymentMethod || "—"}
                            </td>

                            <td className="px-3 py-3 whitespace-nowrap">
                              {getCreatedByName(expense)}
                            </td>

                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedExpense(expense)}
                                  className="px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                                >
                                  View
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEdit(expense)}
                                  className="px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(expense)}
                                  disabled={actionId === id}
                                  className="px-2.5 py-1.5 rounded-md bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  {actionId === id ? "..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5">
                    <div className="text-sm text-gray-500">
                      Page{" "}
                      <span className="font-medium text-gray-900">
                        {pagination.page}
                      </span>{" "}
                      of{" "}
                      <span className="font-medium text-gray-900">
                        {pagination.totalPages}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={!pagination.hasPreviousPage}
                        onClick={() => goToPage(currentPage - 1)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>

                      {pageNumbers.map((page) => (
                        <button
                          type="button"
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`min-w-[40px] px-3 py-2 rounded-lg text-sm ${
                            page === currentPage
                              ? "bg-green-600 text-white"
                              : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={!pagination.hasNextPage}
                        onClick={() => goToPage(currentPage + 1)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================================================== */}
        {/* DELETED TABLE */}
        {/* ================================================== */}

        {activeTab === "deleted" && (
          <div className="p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Deleted Expenses
                </h2>

                <p className="text-sm text-gray-500">
                  Deleted records remain available for audit and restoration.
                </p>
              </div>

              <button
                type="button"
                onClick={loadDeletedExpenses}
                disabled={deletedLoading}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh Deleted
              </button>
            </div>

            {deletedLoading ? (
              <div className="py-16 text-center text-gray-500">
                Loading deleted expenses...
              </div>
            ) : deletedExpenses.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                No deleted expenses found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-3 py-3">Reference</th>

                      <th className="text-left px-3 py-3">Date</th>

                      <th className="text-left px-3 py-3">Category</th>

                      <th className="text-left px-3 py-3">Description</th>

                      <th className="text-right px-3 py-3">Amount</th>

                      <th className="text-left px-3 py-3">Deleted By</th>

                      <th className="text-left px-3 py-3">Deleted At</th>

                      <th className="text-right px-3 py-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {deletedExpenses.map((expense) => {
                      const id = getExpenseId(expense);

                      return (
                        <tr
                          key={id}
                          className="border-b border-gray-100 bg-red-50/30"
                        >
                          <td className="px-3 py-3 font-medium text-gray-700 whitespace-nowrap">
                            {expense?.expenseNumber || "—"}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {formatDate(expense?.date)}
                          </td>

                          <td className="px-3 py-3">
                            {expense?.category || "—"}
                          </td>

                          <td className="px-3 py-3 min-w-[220px]">
                            {expense?.description || "—"}
                          </td>

                          <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                            {formatCurrency(expense?.amount)}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {getDeletedByName(expense)}
                          </td>

                          <td className="px-3 py-3 whitespace-nowrap">
                            {formatDateTime(expense?.deletedAt)}
                          </td>

                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedExpense(expense)}
                                className="px-2.5 py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                              >
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() => handleRestore(expense)}
                                disabled={actionId === id}
                                className="px-2.5 py-1.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                              >
                                {actionId === id ? "..." : "Restore"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* DETAILS MODAL */}
      {/* ================================================== */}

      {selectedExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedExpense(null);
            }
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Expense Details
                </h2>

                <p className="text-sm text-gray-500">
                  {selectedExpense.expenseNumber || "Expense Record"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* EXPENSE INFORMATION */}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Expense Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Expense Number</p>

                    <p className="font-medium">
                      {selectedExpense.expenseNumber || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Date</p>

                    <p className="font-medium">
                      {formatDate(selectedExpense.date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Category</p>

                    <p className="font-medium">
                      {selectedExpense.category || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Payment Method</p>

                    <p className="font-medium">
                      {selectedExpense.paymentMethod || "—"}
                    </p>
                  </div>

                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500">Description</p>

                    <p className="font-medium">
                      {selectedExpense.description || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* FINANCIAL INFORMATION */}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Financial Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Quantity</p>

                    <p className="font-semibold">
                      {formatNumber(selectedExpense.quantity)}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Unit Cost</p>

                    <p className="font-semibold">
                      {formatCurrency(selectedExpense.unitCost)}
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total Amount</p>

                    <p className="font-bold text-green-700">
                      {formatCurrency(selectedExpense.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {/* SUPPLIER */}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Supplier</h3>

                <p className="text-gray-700">
                  {selectedExpense.supplier || "No supplier recorded."}
                </p>
              </div>

              {/* REMARKS */}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Remarks</h3>

                <p className="text-gray-700 whitespace-pre-wrap">
                  {selectedExpense.remarks || "No remarks recorded."}
                </p>
              </div>

              {/* AUDIT */}

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">
                  Audit Trail
                </h3>

                <div className="space-y-3">
                  <div className="border-l-2 border-green-500 pl-3">
                    <p className="text-sm font-medium text-gray-900">Created</p>

                    <p className="text-sm text-gray-600">
                      {getCreatedByName(selectedExpense)}
                    </p>

                    <p className="text-xs text-gray-500">
                      {formatDateTime(selectedExpense.createdAt)}
                    </p>
                  </div>

                  {selectedExpense.updatedAt &&
                    selectedExpense.updatedByName && (
                      <div className="border-l-2 border-blue-500 pl-3">
                        <p className="text-sm font-medium text-gray-900">
                          Last Updated
                        </p>

                        <p className="text-sm text-gray-600">
                          {getUpdatedByName(selectedExpense)}
                        </p>

                        <p className="text-xs text-gray-500">
                          {formatDateTime(selectedExpense.updatedAt)}
                        </p>
                      </div>
                    )}

                  {selectedExpense.isDeleted && (
                    <div className="border-l-2 border-red-500 pl-3">
                      <p className="text-sm font-medium text-red-700">
                        Deleted
                      </p>

                      <p className="text-sm text-gray-600">
                        {getDeletedByName(selectedExpense)}
                      </p>

                      <p className="text-xs text-gray-500">
                        {formatDateTime(selectedExpense.deletedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedExpense(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>

              {!selectedExpense.isDeleted && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExpense(null);

                    handleEdit(selectedExpense);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Edit Expense
                </button>
              )}

              {selectedExpense.isDeleted && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExpense(null);

                    handleRestore(selectedExpense);
                  }}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
                >
                  Restore Expense
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
