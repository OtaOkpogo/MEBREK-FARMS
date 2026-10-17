import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  getProductionReport,
  getEggSalesReport,
  getManureSalesReport,
  getFeedReport,
  getMortalityReport,
  getVaccinationReport,
  getWarehouseReport,
  getStaffReport,
} from "../services/reportService";

// ============================================================
// CONSTANTS
// ============================================================

const REPORT_TYPES = [
  "Production",
  "Battery Cage Combined",
  "Egg Sales",
  "Manure Sales",
  "Feed Usage",
  "Mortality",
  "Vaccination",
  "Warehouse",
  "Staff",
];

const BATTERY_CAGE_PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
];

const COLORS = [
  "#166534",
  "#0f766e",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#2563eb",
  "#be185d",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T.*)?$/;

// ============================================================
// GENERAL HELPERS
// ============================================================

const getNumber = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }

  return 0;
};

const getValue = (row, ...keys) => {
  if (!row || typeof row !== "object") return undefined;

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }

  return undefined;
};

const unwrapResponse = (response) => {
  let result = response;

  for (let i = 0; i < 3; i += 1) {
    if (
      result &&
      typeof result === "object" &&
      !Array.isArray(result) &&
      result.data !== undefined &&
      (result.status !== undefined ||
        result.headers !== undefined ||
        Object.keys(result).length === 1)
    ) {
      result = result.data;
      continue;
    }

    break;
  }

  return result;
};

const getCalendarDateKey = (value) => {
  if (!value) return "";

  if (typeof value === "string" && ISO_DATE_PATTERN.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatReportDate = (value) => {
  if (!value) return "—";

  const dateKey = getCalendarDateKey(value);

  if (!dateKey) return String(value);

  const [year, month, day] = dateKey.split("-");

  return `${day}/${month}/${year}`;
};

const formatNumber = (value, maximumFractionDigits = 2) =>
  getNumber(value).toLocaleString("en-NG", {
    maximumFractionDigits,
  });

const formatCellValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "boolean") return value ? "Yes" : "No";

  if (typeof value === "string" && ISO_DATE_PATTERN.test(value)) {
    return formatReportDate(value);
  }

  if (typeof value === "number") return formatNumber(value);

  if (typeof value === "object") {
    if (value.name) return value.name;
    if (value._id) return String(value._id);
    return JSON.stringify(value);
  }

  return String(value);
};

const formatRecordForDisplay = (record) => {
  if (!record || typeof record !== "object") return {};

  const formatted = {};

  Object.entries(record).forEach(([key, value]) => {
    if (["_id", "__v", "isDeleted", "deletedAt", "updatedAt"].includes(key)) {
      return;
    }

    formatted[key] = value;
  });

  return formatted;
};

// ============================================================
// PRODUCTION NORMALIZATION
// ============================================================

const normalizeProductionRow = (row = {}) => {
  const date = getValue(row, "date", "Date", "productionDate");
  const pen = getValue(row, "pen", "Pen", "penName", "house", "houseName");

  const openingStock = getNumber(getValue(row, "openingStock", "OpeningStock"));
  const mortality = getNumber(getValue(row, "mortality", "Mortality"));

  const closingStock = getNumber(
    getValue(row, "closingStock", "ClosingStock"),
    openingStock - mortality,
  );

  const feedConsumed = getNumber(
    getValue(
      row,
      "feedBagsConsumed",
      "FeedConsumed",
      "feedConsumed",
      "feedBags",
    ),
  );

  const cratesProduced = getNumber(
    getValue(row, "cratesProduced", "CratesProduced"),
  );

  const extraEggPieces = getNumber(
    getValue(row, "extraEggPieces", "ExtraEggPieces", "looseEggs"),
  );

  const totalEggs = getNumber(
    getValue(row, "totalEggs", "TotalEggs"),
    cratesProduced * 30 + extraEggPieces,
  );

  const productionPercentage = getNumber(
    getValue(row, "productionPercentage", "ProductionPercentage"),
    openingStock > 0 ? (totalEggs / openingStock) * 100 : 0,
  );

  return {
    ...row,
    Date: date,
    Pen: pen || "Unknown Pen",
    OpeningStock: openingStock,
    ClosingStock: closingStock,
    Mortality: mortality,
    FeedConsumed: feedConsumed,
    CratesProduced: cratesProduced,
    ExtraEggPieces: extraEggPieces,
    TotalEggs: totalEggs,
    ProductionPercentage: Number(productionPercentage.toFixed(2)),
  };
};

const extractProductionRows = (response) => {
  const payload = unwrapResponse(response);

  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  if (Array.isArray(payload.tableData)) return payload.tableData;
  if (Array.isArray(payload.records)) return payload.records;
  if (Array.isArray(payload.productions)) return payload.productions;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.data)) return payload.data;

  if (payload.data && typeof payload.data === "object") {
    return extractProductionRows(payload.data);
  }

  return [];
};

const buildProductionSummary = (rows) => {
  const totalEggs = rows.reduce(
    (sum, row) => sum + getNumber(row.TotalEggs),
    0,
  );

  const totalCrates = rows.reduce(
    (sum, row) => sum + getNumber(row.CratesProduced),
    0,
  );

  const feedConsumed = rows.reduce(
    (sum, row) => sum + getNumber(row.FeedConsumed),
    0,
  );

  const totalMortality = rows.reduce(
    (sum, row) => sum + getNumber(row.Mortality),
    0,
  );

  const percentages = rows.map((row) => getNumber(row.ProductionPercentage));

  const averageProduction = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : 0;

  return {
    totalEggs,
    totalCrates,
    feedConsumed,
    totalMortality,
    averageProduction: Number(averageProduction.toFixed(2)),
  };
};

const buildProductionChartData = (rows) => {
  const byDate = new Map();

  rows.forEach((row) => {
    const dateKey = getCalendarDateKey(row.Date);

    if (!dateKey) return;

    const current = byDate.get(dateKey) || {
      dateKey,
      name: formatReportDate(dateKey),
      value: 0,
      totalEggs: 0,
      totalMortality: 0,
      feedConsumed: 0,
    };

    current.value += getNumber(row.TotalEggs);
    current.totalEggs += getNumber(row.TotalEggs);
    current.totalMortality += getNumber(row.Mortality);
    current.feedConsumed += getNumber(row.FeedConsumed);

    byDate.set(dateKey, current);
  });

  return Array.from(byDate.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
};

// ============================================================
// EGG SALES NORMALIZATION
// ============================================================

const normalizeEggSalesRow = (row = {}) => {
  const date = getValue(row, "date", "Date", "saleDate");

  const cratesSold = getNumber(
    getValue(row, "cratesSold", "CratesSold", "crates"),
  );

  const looseEggs = getNumber(
    getValue(row, "looseEggs", "LooseEggs", "extraEggs"),
  );

  const totalAmount = getNumber(
    getValue(row, "totalAmount", "TotalAmount", "amount"),
  );

  const amountPaid = getNumber(
    getValue(row, "amountPaid", "AmountPaid", "paid"),
  );

  const balance = getNumber(
    getValue(row, "balance", "Balance"),
    totalAmount - amountPaid,
  );

  return {
    ...row,
    Date: date,
    Invoice: getValue(row, "invoiceNumber", "Invoice", "invoice"),
    Customer: getValue(row, "customer", "Customer", "customerName"),
    CratesSold: cratesSold,
    LooseEggs: looseEggs,
    TotalAmount: totalAmount,
    AmountPaid: amountPaid,
    Balance: balance,
    PaymentMethod: getValue(row, "paymentMethod", "PaymentMethod"),
    Status: getValue(row, "status", "Status"),
  };
};

// ============================================================
// RAW ARRAY TRANSFORMERS
// ============================================================

const RAW_ARRAY_TRANSFORMERS = {
  Production: (rows) => {
    const records = rows.map(normalizeProductionRow);

    return {
      records,
      summary: buildProductionSummary(records),
      chartData: buildProductionChartData(records),
    };
  },

  "Battery Cage Combined": (rows) => {
    const records = rows.map(normalizeProductionRow);

    return {
      records,
      summary: buildProductionSummary(records),
      chartData: buildProductionChartData(records),
    };
  },

  "Egg Sales": (rows) => {
    const records = rows.map(normalizeEggSalesRow);

    const totalSales = records.reduce(
      (sum, row) => sum + getNumber(row.TotalAmount),
      0,
    );

    const amountPaid = records.reduce(
      (sum, row) => sum + getNumber(row.AmountPaid),
      0,
    );

    const balance = records.reduce(
      (sum, row) => sum + getNumber(row.Balance),
      0,
    );

    return {
      records,
      summary: {
        totalSales,
        amountPaid,
        balance,
        totalTransactions: records.length,
      },
      chartData: [],
    };
  },
};

// ============================================================
// BATTERY CAGE COMBINED REPORT
// ============================================================

const buildBatteryCageCombinedReport = (response, startDate, endDate) => {
  const payload = unwrapResponse(response);

  let rows = extractProductionRows(payload)
    .filter((row) => row?.isDeleted !== true)
    .map(normalizeProductionRow);

  if (startDate) {
    rows = rows.filter((row) => {
      const dateKey = getCalendarDateKey(row.Date);
      return dateKey && dateKey >= startDate;
    });
  }

  if (endDate) {
    rows = rows.filter((row) => {
      const dateKey = getCalendarDateKey(row.Date);
      return dateKey && dateKey <= endDate;
    });
  }

  rows = rows.filter((row) => BATTERY_CAGE_PENS.includes(row.Pen));

  const grouped = new Map();

  rows.forEach((row) => {
    const dateKey = getCalendarDateKey(row.Date);

    if (!dateKey) return;

    const current = grouped.get(dateKey) || {
      Date: row.Date,
      Pen: "Battery Cage Combined",
      OpeningStock: 0,
      ClosingStock: 0,
      Mortality: 0,
      FeedConsumed: 0,
      CratesProduced: 0,
      ExtraEggPieces: 0,
      TotalEggs: 0,
      ProductionPercentage: 0,
      RowsIncluded: [],
    };

    current.OpeningStock += getNumber(row.OpeningStock);
    current.ClosingStock += getNumber(row.ClosingStock);
    current.Mortality += getNumber(row.Mortality);
    current.FeedConsumed += getNumber(row.FeedConsumed);
    current.CratesProduced += getNumber(row.CratesProduced);
    current.ExtraEggPieces += getNumber(row.ExtraEggPieces);
    current.TotalEggs += getNumber(row.TotalEggs);
    current.RowsIncluded.push(row.Pen);

    grouped.set(dateKey, current);
  });

  const records = Array.from(grouped.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([, row]) => ({
      ...row,
      RowsIncluded: [...new Set(row.RowsIncluded)].join(", "),
      ProductionPercentage:
        row.OpeningStock > 0
          ? Number(((row.TotalEggs / row.OpeningStock) * 100).toFixed(2))
          : 0,
    }));

  return {
    records,
    summary: buildProductionSummary(records),
    chartData: buildProductionChartData(records),
  };
};

// ============================================================
// NORMALIZE API RESPONSE
// ============================================================

const normalizeReportResponse = (reportType, response) => {
  const payload = unwrapResponse(response);

  if (reportType === "Production" || reportType === "Battery Cage Combined") {
    const rows = extractProductionRows(payload)
      .filter((row) => row?.isDeleted !== true)
      .map(normalizeProductionRow);

    const serverSummary =
      payload && !Array.isArray(payload) ? payload.summary || {} : {};

    return {
      records: rows,
      summary: {
        ...buildProductionSummary(rows),
        ...serverSummary,
      },
      chartData: buildProductionChartData(rows),
    };
  }

  if (Array.isArray(payload)) {
    const activeRows = payload.filter((row) => row?.isDeleted !== true);
    const transformer = RAW_ARRAY_TRANSFORMERS[reportType];

    if (transformer) return transformer(activeRows);

    return {
      records: activeRows.map(formatRecordForDisplay),
      summary: {},
      chartData: [],
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      records: [],
      summary: {},
      chartData: [],
    };
  }

  let rawRecords = [];

  if (Array.isArray(payload.tableData)) {
    rawRecords = payload.tableData;
  } else if (Array.isArray(payload.records)) {
    rawRecords = payload.records;
  } else if (Array.isArray(payload.results)) {
    rawRecords = payload.results;
  } else if (Array.isArray(payload.items)) {
    rawRecords = payload.items;
  } else if (Array.isArray(payload.data)) {
    rawRecords = payload.data;
  } else if (payload.data && typeof payload.data === "object") {
    return normalizeReportResponse(reportType, payload.data);
  }

  const activeRows = rawRecords.filter((row) => row?.isDeleted !== true);
  const transformer = RAW_ARRAY_TRANSFORMERS[reportType];

  if (transformer) {
    const transformed = transformer(activeRows);

    return {
      ...transformed,
      summary: {
        ...transformed.summary,
        ...(payload.summary || {}),
      },
      chartData:
        Array.isArray(payload.chartData) && payload.chartData.length
          ? payload.chartData
          : transformed.chartData,
    };
  }

  return {
    records: activeRows.map(formatRecordForDisplay),
    summary: payload.summary || {},
    chartData: Array.isArray(payload.chartData) ? payload.chartData : [],
  };
};

// ============================================================
// PRESENTATIONAL COMPONENTS
// ============================================================

function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-green-800">
            {eyebrow}
          </p>
        )}

        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
        )}
      </div>

      {action}
    </div>
  );
}

function MetricCard({ label, value, icon, tone, description }) {
  const tones = {
    blue: {
      icon: "bg-blue-50 text-blue-800 ring-blue-200",
      accent: "bg-blue-600",
    },
    green: {
      icon: "bg-green-100 text-green-900 ring-green-200",
      accent: "bg-green-700",
    },
    amber: {
      icon: "bg-amber-100 text-amber-900 ring-amber-200",
      accent: "bg-amber-600",
    },
    red: {
      icon: "bg-rose-100 text-rose-900 ring-rose-200",
      accent: "bg-rose-600",
    },
    purple: {
      icon: "bg-violet-100 text-violet-900 ring-violet-200",
      accent: "bg-violet-600",
    },
    slate: {
      icon: "bg-slate-100 text-slate-800 ring-slate-200",
      accent: "bg-slate-600",
    },
  };

  const style = tones[tone] || tones.green;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-green-400 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${style.accent}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">{label}</p>

          <p className="mt-3 break-words text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>

          {description && (
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {description}
            </p>
          )}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ring-1 ${style.icon}`}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT
// ============================================================

export default function Reports() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  const userRole = String(currentUser?.role || "").toLowerCase();
  const hasReportsAccess = ["superadmin", "manager"].includes(userRole);

  const [reportType, setReportType] = useState("Production");

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return getCalendarDateKey(date);
  });

  const [endDate, setEndDate] = useState(() => getCalendarDateKey(new Date()));

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [chartData, setChartData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const isProductionReport =
    reportType === "Production" || reportType === "Battery Cage Combined";

  const loadReport = useCallback(async () => {
    if (!hasReportsAccess) return;

    if (startDate && endDate && startDate > endDate) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    setLoading(true);

    try {
      const params = { startDate, endDate };
      let response;

      switch (reportType) {
        case "Production":
        case "Battery Cage Combined":
          response = await getProductionReport(params);
          break;
        case "Egg Sales":
          response = await getEggSalesReport(params);
          break;
        case "Manure Sales":
          response = await getManureSalesReport(params);
          break;
        case "Feed Usage":
          response = await getFeedReport(params);
          break;
        case "Mortality":
          response = await getMortalityReport(params);
          break;
        case "Vaccination":
          response = await getVaccinationReport(params);
          break;
        case "Warehouse":
          response = await getWarehouseReport(params);
          break;
        case "Staff":
          response = await getStaffReport(params);
          break;
        default:
          response = [];
      }

      const normalized =
        reportType === "Battery Cage Combined"
          ? buildBatteryCageCombinedReport(response, startDate, endDate)
          : normalizeReportResponse(reportType, response);

      console.log(
        `[Reports] ${reportType} API response:`,
        unwrapResponse(response),
      );
      console.log(
        `[Reports] ${reportType} normalized records:`,
        normalized.records,
      );
      console.log(`[Reports] ${reportType} chart data:`, normalized.chartData);

      setRecords(normalized.records || []);
      setSummary(normalized.summary || {});
      setChartData(normalized.chartData || []);
      setPage(1);

      if ((normalized.records || []).length > 0) {
        toast.success(`${normalized.records.length} report record(s) loaded.`);
      } else {
        toast.info("No report records found for the selected dates.");
      }
    } catch (error) {
      console.error("Failed to load report:", error);

      setRecords([]);
      setSummary({});
      setChartData([]);

      toast.error(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load report.",
      );
    } finally {
      setLoading(false);
    }
  }, [hasReportsAccess, reportType, startDate, endDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // ==========================================================
  // TABLE COLUMNS
  // ==========================================================

  const columns = useMemo(() => {
    if (!records.length) return [];

    const keys = new Set();

    records.forEach((row) => {
      Object.keys(row || {}).forEach((key) => {
        if (
          !["_id", "__v", "isDeleted", "deletedAt", "updatedAt"].includes(key)
        ) {
          keys.add(key);
        }
      });
    });

    const orderedKeys = Array.from(keys);

    if (orderedKeys.includes("Date")) {
      orderedKeys.splice(orderedKeys.indexOf("Date"), 1);
      orderedKeys.unshift("Date");
    }

    return orderedKeys;
  }, [records]);

  // ==========================================================
  // SEARCH AND PAGINATION
  // ==========================================================

  const filteredRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((record) =>
      Object.values(record || {}).some((value) =>
        formatCellValue(value).toLowerCase().includes(keyword),
      ),
    );
  }, [records, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const paginatedRecords = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredRecords.slice(startIndex, startIndex + pageSize);
  }, [filteredRecords, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // ==========================================================
  // SUMMARY CARDS
  // ==========================================================

  const summaryCards = useMemo(() => {
    if (isProductionReport) {
      return [
        {
          label: "Total Eggs",
          value: getNumber(summary.totalEggs),
          icon: "🥚",
          tone: "green",
          description: "Eggs recorded in this period",
        },
        {
          label: "Crates Produced",
          value: getNumber(summary.totalCrates),
          icon: "📦",
          tone: "green",
          description: "Production output in crates",
        },
        {
          label: "Feed Consumed",
          value: getNumber(summary.feedConsumed),
          icon: "🌾",
          tone: "amber",
          description: "Recorded feed consumption",
        },
        {
          label: "Total Mortality",
          value: getNumber(summary.totalMortality),
          icon: "🐔",
          tone: "red",
          description: "Bird losses recorded",
        },
        {
          label: "Average Production",
          value: `${formatNumber(summary.averageProduction)}%`,
          icon: "📈",
          tone: "purple",
          description: "Average recorded production rate",
        },
      ];
    }

    if (reportType === "Egg Sales") {
      return [
        {
          label: "Total Sales",
          value: `₦${formatNumber(summary.totalSales, 0)}`,
          icon: "💰",
          tone: "green",
          description: "Total sales value",
        },
        {
          label: "Amount Paid",
          value: `₦${formatNumber(summary.amountPaid, 0)}`,
          icon: "✅",
          tone: "blue",
          description: "Payments received",
        },
        {
          label: "Outstanding Balance",
          value: `₦${formatNumber(summary.balance, 0)}`,
          icon: "🧾",
          tone: "amber",
          description: "Unpaid customer balances",
        },
        {
          label: "Transactions",
          value: getNumber(summary.totalTransactions),
          icon: "📊",
          tone: "purple",
          description: "Sales transactions in this period",
        },
      ];
    }

    if (Object.keys(summary).length > 0) {
      return Object.entries(summary)
        .filter(([, value]) => ["string", "number"].includes(typeof value))
        .slice(0, 6)
        .map(([key, value], index) => ({
          label: key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (char) => char.toUpperCase()),
          value: typeof value === "number" ? formatNumber(value) : value,
          icon: ["📊", "📋", "📦", "🌾", "🐔", "✅"][index],
          tone: ["green", "green", "amber", "purple", "red", "slate"][index],
        }));
    }

    return [
      {
        label: "Total Records",
        value: records.length,
        icon: "📋",
        tone: "green",
      },
    ];
  }, [isProductionReport, reportType, summary, records.length]);

  // ==========================================================
  // EXPORT TO EXCEL
  // ==========================================================

  const exportExcel = () => {
    if (!filteredRecords.length) {
      toast.info("There are no records to export.");
      return;
    }

    try {
      const exportRows = filteredRecords.map((record) => {
        const output = {};

        columns.forEach((column) => {
          output[column] =
            column === "Date"
              ? formatReportDate(record[column])
              : record[column];
        });

        return output;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

      const fileDate = getCalendarDateKey(new Date());
      const safeReportName = reportType.replace(/[^a-z0-9]+/gi, "_");

      XLSX.writeFile(workbook, `${safeReportName}_Report_${fileDate}.xlsx`);

      toast.success("Excel report exported successfully.");
    } catch (error) {
      console.error("Excel export failed:", error);
      toast.error("Failed to export Excel report.");
    }
  };

  // ==========================================================
  // EXPORT TO PDF
  // ==========================================================

  const exportPDF = () => {
    if (!filteredRecords.length) {
      toast.info("There are no records to export.");
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: columns.length > 6 ? "landscape" : "portrait",
      });

      pdf.setFontSize(17);
      pdf.setTextColor(20, 83, 45);
      pdf.text("MEBREK FARMS", 14, 15);

      pdf.setFontSize(12);
      pdf.setTextColor(21, 128, 61);
      pdf.text(`${reportType} Report`, 14, 23);

      pdf.setFontSize(9);
      pdf.setTextColor(71, 85, 105);
      pdf.text(`Period: ${startDate || "All"} to ${endDate || "All"}`, 14, 30);
      pdf.text(`Generated: ${formatReportDate(new Date())}`, 14, 36);

      autoTable(pdf, {
        startY: 42,
        head: [columns],
        body: filteredRecords.map((record) =>
          columns.map((column) => formatCellValue(record[column])),
        ),
        styles: {
          fontSize: 7,
          cellPadding: 2.5,
          overflow: "linebreak",
          textColor: [51, 65, 85],
        },
        headStyles: {
          fillColor: [20, 83, 45],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: {
          fillColor: [236, 253, 245],
        },
        margin: {
          left: 10,
          right: 10,
        },
      });

      const pageCount = pdf.internal.getNumberOfPages();

      for (let i = 1; i <= pageCount; i += 1) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(71, 85, 105);
        pdf.text(
          `Mebrek Farms • ${reportType} Report`,
          10,
          pdf.internal.pageSize.getHeight() - 7,
        );
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pdf.internal.pageSize.getWidth() - 30,
          pdf.internal.pageSize.getHeight() - 7,
        );
      }

      const fileDate = getCalendarDateKey(new Date());
      const safeReportName = reportType.replace(/[^a-z0-9]+/gi, "_");

      pdf.save(`${safeReportName}_Report_${fileDate}.pdf`);

      toast.success("PDF report exported successfully.");
    } catch (error) {
      console.error("PDF export failed:", error);
      toast.error("Failed to export PDF report.");
    }
  };

  // ==========================================================
  // ACCESS CONTROL
  // ==========================================================

  if (!hasReportsAccess) {
    return (
      <div className="min-h-[60vh] bg-slate-100 p-5 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl">
            🔒
          </div>

          <h2 className="text-xl font-bold text-slate-950">
            Access Restricted
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            Reports are available to Super Admin and Manager accounts only.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="relative min-h-screen space-y-7 bg-slate-100 p-4 md:p-6 xl:p-8">
      {loading && (
        <div className="absolute inset-0 z-30 flex items-start justify-center rounded-2xl bg-slate-100/80 pt-32 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-white px-6 py-4 shadow-xl">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-green-800 border-t-transparent" />
            <span className="text-sm font-bold text-slate-800">
              Loading report...
            </span>
          </div>
        </div>
      )}

      {/* DARK, HIGH-CONTRAST PAGE HEADER */}

      <section className="relative overflow-hidden rounded-3xl border border-green-950 bg-gradient-to-br from-green-950 via-green-900 to-teal-900 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-52 w-52 rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold tracking-wide text-white">
              <span className="h-2 w-2 rounded-full bg-lime-400" />
              MEBREK FARMS ANALYTICS
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Reports &amp; Insights
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-green-50 sm:text-base">
              Monitor farm performance, review production records, and export
              reports for management decisions.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-white">
              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                {reportType}
              </span>

              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                {formatReportDate(startDate)} – {formatReportDate(endDate)}
              </span>

              <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5">
                {formatNumber(filteredRecords.length, 0)} records
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadReport}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true">↻</span>
              Refresh
            </button>

            <button
              type="button"
              onClick={exportExcel}
              disabled={loading || filteredRecords.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-green-500 bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-green-500 focus:outline-none focus:ring-4 focus:ring-green-300/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true">↓</span>
              Excel
            </button>

            <button
              type="button"
              onClick={exportPDF}
              disabled={loading || filteredRecords.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white bg-white px-4 py-3 text-sm font-bold text-green-950 shadow-sm transition hover:bg-green-50 focus:outline-none focus:ring-4 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span aria-hidden="true">▤</span>
              PDF
            </button>
          </div>
        </div>
      </section>

      {/* FILTERS */}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          eyebrow="Report controls"
          title="Find the information you need"
          description="Choose a report, select a date range, or search through your records."
          action={
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-green-200 bg-green-100 px-3 py-1.5 text-xs font-bold text-green-950">
              <span
                className={`h-2 w-2 rounded-full ${
                  loading ? "bg-amber-500" : "bg-green-700"
                }`}
              />
              {loading ? "Updating" : "Ready"}
            </span>
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label
              htmlFor="reportType"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
            >
              Report type
            </label>

            <select
              id="reportType"
              value={reportType}
              onChange={(event) => {
                setReportType(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/15"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="startDate"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
            >
              Start date
            </label>

            <input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/15"
            />
          </div>

          <div>
            <label
              htmlFor="endDate"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
            >
              End date
            </label>

            <input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/15"
            />
          </div>

          <div>
            <label
              htmlFor="reportSearch"
              className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-slate-700"
            >
              Search records
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                ⌕
              </span>

              <input
                id="reportSearch"
                type="search"
                placeholder="Search report..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-green-700 focus:bg-white focus:ring-4 focus:ring-green-700/15"
              />
            </div>
          </div>
        </div>

        {reportType === "Battery Cage Combined" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-green-300 bg-green-100 p-4 text-sm text-green-950">
            <span className="text-xl" aria-hidden="true">
              ℹ
            </span>

            <div>
              <p className="font-extrabold">Combined Battery Cage report</p>

              <p className="mt-1 leading-5 text-green-950">
                Combines production from Battery Cage Rows 1, 2, and 3 by date.
                Individual pen records remain unchanged.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* KEY METRICS */}

      <section>
        <SectionHeading
          eyebrow="At a glance"
          title={
            isProductionReport
              ? "Production performance"
              : `${reportType} overview`
          }
          description="A quick summary of the figures in the selected report."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {summaryCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* CHARTS */}

      {chartData.length > 0 && (
        <section>
          <SectionHeading
            eyebrow="Visual analytics"
            title={
              isProductionReport
                ? "Production trends"
                : `${reportType} analytics`
            }
            description="Review the report visually to spot patterns across the selected period."
          />

          <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">
                    {isProductionReport
                      ? "Egg Production by Date"
                      : `${reportType} Overview`}
                  </h3>

                  <p className="mt-1 text-xs text-slate-600">
                    {isProductionReport
                      ? "Total eggs recorded for each production date"
                      : "Values returned by the selected report"}
                  </p>
                </div>

                <span className="rounded-xl bg-green-100 px-3 py-2 text-lg text-green-900">
                  ▥
                </span>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#475569" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={false}
                      tickMargin={10}
                      interval="preserveStartEnd"
                    />

                    <YAxis
                      yAxisId="eggs"
                      allowDecimals={false}
                      width={65}
                      tick={{ fontSize: 11, fill: "#475569" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) =>
                        Number(value).toLocaleString("en-NG")
                      }
                    />

                    <Tooltip
                      cursor={{ fill: "#ecfdf5" }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #bbf7d0",
                        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                        fontSize: 12,
                        color: "#0f172a",
                      }}
                      formatter={(value, name) => [
                        Number(value || 0).toLocaleString("en-NG"),
                        name,
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />

                    <Legend
                      wrapperStyle={{
                        fontSize: 12,
                        paddingTop: 12,
                        color: "#334155",
                      }}
                    />

                    <Bar
                      yAxisId="eggs"
                      dataKey={isProductionReport ? "totalEggs" : "value"}
                      name={isProductionReport ? "Total Eggs" : "Value"}
                      fill={COLORS[0]}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                      minPointSize={4}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {isProductionReport && (
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Production and Mortality Trend
                    </h3>

                    <p className="mt-1 text-xs text-slate-600">
                      Egg totals and recorded bird losses by date
                    </p>
                  </div>

                  <span className="rounded-xl bg-green-100 px-3 py-2 text-lg text-green-900">
                    ↗
                  </span>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />

                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={{ stroke: "#cbd5e1" }}
                        tickLine={false}
                        tickMargin={10}
                        interval="preserveStartEnd"
                      />

                      <YAxis
                        yAxisId="eggs"
                        orientation="left"
                        allowDecimals={false}
                        width={65}
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) =>
                          Number(value).toLocaleString("en-NG")
                        }
                      />

                      <YAxis
                        yAxisId="mortality"
                        orientation="right"
                        allowDecimals={false}
                        width={42}
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #bbf7d0",
                          boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
                          fontSize: 12,
                          color: "#0f172a",
                        }}
                        formatter={(value, name) => [
                          Number(value || 0).toLocaleString("en-NG"),
                          name,
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />

                      <Legend
                        wrapperStyle={{
                          fontSize: 12,
                          paddingTop: 12,
                          color: "#334155",
                        }}
                      />

                      <Line
                        yAxisId="eggs"
                        type="monotone"
                        dataKey="totalEggs"
                        name="Total Eggs"
                        stroke={COLORS[1]}
                        strokeWidth={3}
                        dot={{ r: 3.5, fill: COLORS[1], strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                        isAnimationActive={false}
                      />

                      <Line
                        yAxisId="mortality"
                        type="monotone"
                        dataKey="totalMortality"
                        name="Mortality"
                        stroke={COLORS[3]}
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: COLORS[3], strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* RECORDS TABLE */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-xl text-green-950">
              ▤
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {reportType} Records
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {formatNumber(filteredRecords.length, 0)} record(s) found
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="pageSize"
              className="whitespace-nowrap text-xs font-bold text-slate-700"
            >
              Rows per page
            </label>

            <select
              id="pageSize"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-green-700 focus:ring-4 focus:ring-green-700/15"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-3xl">
              📋
            </div>

            <h3 className="mt-5 text-base font-bold text-slate-900">
              No records to display
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              No records match your current report and date selection. Try a
              different date range or search term.
            </p>

            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-4 rounded-lg bg-green-100 px-4 py-2 text-sm font-bold text-green-950 transition hover:bg-green-200"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-green-900">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="whitespace-nowrap px-5 py-4 text-left text-[11px] font-extrabold uppercase tracking-wider text-white"
                      >
                        {column.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {paginatedRecords.map((record, index) => (
                    <tr
                      key={
                        record._id ||
                        `${getCalendarDateKey(record.Date)}-${index}`
                      }
                      className="transition-colors hover:bg-emerald-50"
                    >
                      {columns.map((column) => {
                        const value = record[column];
                        const isPercentage = column === "ProductionPercentage";

                        const isMortality =
                          column.toLowerCase().includes("mortality") ||
                          column.toLowerCase().includes("death");

                        return (
                          <td
                            key={column}
                            className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-800"
                          >
                            {column === "Date" ? (
                              <span className="font-semibold text-slate-800">
                                {formatReportDate(value)}
                              </span>
                            ) : isPercentage ? (
                              <span className="inline-flex rounded-full border border-green-200 bg-green-100 px-2.5 py-1 text-xs font-extrabold text-green-950">
                                {formatNumber(value)}%
                              </span>
                            ) : isMortality && getNumber(value) > 0 ? (
                              <span className="inline-flex rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-900">
                                {formatCellValue(value)}
                              </span>
                            ) : (
                              formatCellValue(value)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 bg-slate-100 px-5 py-4 sm:flex-row sm:px-6">
              <p className="text-xs font-medium text-slate-700">
                Showing{" "}
                <span className="font-extrabold text-slate-950">
                  {(page - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-extrabold text-slate-950">
                  {Math.min(page * pageSize, filteredRecords.length)}
                </span>{" "}
                of{" "}
                <span className="font-extrabold text-slate-950">
                  {formatNumber(filteredRecords.length, 0)}
                </span>{" "}
                records
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <span className="rounded-xl bg-green-900 px-4 py-2.5 text-xs font-extrabold text-white">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:border-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* FOOTER */}

      <div className="flex flex-col justify-between gap-2 border-t border-slate-300 pt-4 text-xs font-medium text-slate-600 sm:flex-row sm:items-center">
        <p>
          © {new Date().getFullYear()} Mebrek Farms · Reports &amp; Analytics
        </p>

        <p>Figures reflect records returned for the selected report period.</p>
      </div>
    </div>
  );
}
