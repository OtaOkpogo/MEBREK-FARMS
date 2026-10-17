import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
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
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#9333ea",
  "#0891b2",
  "#db2777",
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

  // Supports Axios responses and services that return response.data.
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

  // Preserve the date portion returned by the API to avoid
  // changing the calendar date because of timezone conversion.
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

const formatCellValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && ISO_DATE_PATTERN.test(value)) {
    return formatReportDate(value);
  }

  if (typeof value === "number") {
    return value.toLocaleString("en-NG", {
      maximumFractionDigits: 2,
    });
  }

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
    if (
      key === "_id" ||
      key === "__v" ||
      key === "isDeleted" ||
      key === "deletedAt" ||
      key === "updatedAt"
    ) {
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

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.tableData)) {
    return payload.tableData;
  }

  if (Array.isArray(payload.records)) {
    return payload.records;
  }

  if (Array.isArray(payload.productions)) {
    return payload.productions;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

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

// IMPORTANT:
// Build chart data from normalized production records.
// The backend chartData uses { name, value }, but the production
// charts need totalEggs, totalMortality, and feedConsumed.
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

      // FIX: Do not use the backend's chartData for production.
      // It has { name, value }, not the fields the charts expect.
      chartData: buildProductionChartData(rows),
    };
  }

  if (Array.isArray(payload)) {
    const activeRows = payload.filter((row) => row?.isDeleted !== true);

    const transformer = RAW_ARRAY_TRANSFORMERS[reportType];

    if (transformer) {
      return transformer(activeRows);
    }

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

    // For production reports, use locally generated chart data.
    // For other report types, preserve the existing API behavior.
    const isProductionReport =
      reportType === "Production" || reportType === "Battery Cage Combined";

    return {
      ...transformed,

      summary: {
        ...transformed.summary,
        ...(payload.summary || {}),
      },

      chartData: isProductionReport
        ? transformed.chartData
        : Array.isArray(payload.chartData) && payload.chartData.length
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

  const loadReport = useCallback(async () => {
    if (!hasReportsAccess) return;

    if (startDate && endDate && startDate > endDate) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    setLoading(true);

    try {
      const params = {
        startDate,
        endDate,
      };

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
    const rows = records || [];

    if (rows.length === 0) return [];

    const keys = new Set();

    rows.forEach((row) => {
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
    if (reportType === "Production" || reportType === "Battery Cage Combined") {
      return [
        {
          label: "Total Eggs",
          value: getNumber(summary.totalEggs),
        },
        {
          label: "Crates Produced",
          value: getNumber(summary.totalCrates),
        },
        {
          label: "Feed Consumed",
          value: getNumber(summary.feedConsumed),
        },
        {
          label: "Total Mortality",
          value: getNumber(summary.totalMortality),
        },
        {
          label: "Average Production",
          value: `${getNumber(summary.averageProduction).toLocaleString(
            "en-NG",
            {
              maximumFractionDigits: 2,
            },
          )}%`,
        },
      ];
    }

    if (reportType === "Egg Sales") {
      return [
        {
          label: "Total Sales",
          value: `₦${getNumber(summary.totalSales).toLocaleString("en-NG")}`,
        },
        {
          label: "Amount Paid",
          value: `₦${getNumber(summary.amountPaid).toLocaleString("en-NG")}`,
        },
        {
          label: "Outstanding Balance",
          value: `₦${getNumber(summary.balance).toLocaleString("en-NG")}`,
        },
        {
          label: "Transactions",
          value: getNumber(summary.totalTransactions),
        },
      ];
    }

    if (Object.keys(summary).length > 0) {
      return Object.entries(summary)
        .filter(([, value]) => ["string", "number"].includes(typeof value))
        .slice(0, 6)
        .map(([key, value]) => ({
          label: key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (char) => char.toUpperCase()),
          value:
            typeof value === "number"
              ? value.toLocaleString("en-NG", {
                  maximumFractionDigits: 2,
                })
              : value,
        }));
    }

    return [
      {
        label: "Total Records",
        value: records.length,
      },
    ];
  }, [reportType, summary, records.length]);

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

      pdf.setFontSize(16);
      pdf.text(`${reportType} Report`, 14, 16);

      pdf.setFontSize(9);
      pdf.text(`Period: ${startDate || "All"} to ${endDate || "All"}`, 14, 23);

      autoTable(pdf, {
        startY: 29,
        head: [columns],
        body: filteredRecords.map((record) =>
          columns.map((column) => formatCellValue(record[column])),
        ),
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [37, 99, 235],
        },
        margin: {
          left: 10,
          right: 10,
        },
      });

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
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="text-lg font-bold">Access Restricted</h2>

          <p className="mt-2">
            Reports are available to Super Admin and Manager accounts only.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  const isProductionReport =
    reportType === "Production" || reportType === "Battery Cage Combined";

  return (
    <div className="relative space-y-6 p-4 md:p-6">
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/75">
          <div className="flex items-center gap-3 rounded-lg bg-white px-5 py-4 shadow-lg">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />

            <span className="font-medium text-gray-700">Loading report...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>

          <p className="mt-1 text-sm text-gray-500">
            Review, filter, and export farm reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={exportExcel}
            disabled={loading || filteredRecords.length === 0}
            className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={exportPDF}
            disabled={loading || filteredRecords.length === 0}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* REPORT FILTERS */}

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="reportType"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Report Type
          </label>

          <select
            id="reportType"
            value={reportType}
            onChange={(event) => {
              setReportType(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
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
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Start Date
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            End Date
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="reportSearch"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Search Records
          </label>

          <input
            id="reportSearch"
            type="search"
            placeholder="Search report..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {reportType === "Battery Cage Combined" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <strong>Combined report:</strong> combines production from Battery
          Cage Rows 1, 2, and 3 by date. The original individual pen records
          remain unchanged.
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>

            <p className="mt-2 break-words text-2xl font-bold text-gray-800">
              {typeof card.value === "number"
                ? card.value.toLocaleString("en-NG", {
                    maximumFractionDigits: 2,
                  })
                : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* CHARTS */}

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* EGG PRODUCTION BAR CHART */}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              {isProductionReport
                ? "Egg Production by Date"
                : `${reportType} Overview`}
            </h2>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 12,
                    left: 8,
                    bottom: 8,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />

                  <YAxis yAxisId="eggs" allowDecimals={false} width={65} />

                  <Tooltip
                    formatter={(value, name) => [
                      Number(value || 0).toLocaleString("en-NG"),
                      name,
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />

                  <Legend />

                  <Bar
                    yAxisId="eggs"
                    dataKey={isProductionReport ? "totalEggs" : "value"}
                    name={isProductionReport ? "Total Eggs" : "Value"}
                    fill={COLORS[0]}
                    radius={[4, 4, 0, 0]}
                    minPointSize={4}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PRODUCTION AND MORTALITY TREND */}

          {isProductionReport && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Production and Mortality Trend
              </h2>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 20,
                      left: 8,
                      bottom: 8,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />

                    {/* Egg totals use the left axis. */}
                    <YAxis
                      yAxisId="eggs"
                      orientation="left"
                      allowDecimals={false}
                      width={65}
                    />

                    {/* Mortality has a separate scale so small
                        mortality figures remain visible. */}
                    <YAxis
                      yAxisId="mortality"
                      orientation="right"
                      allowDecimals={false}
                      width={45}
                    />

                    <Tooltip
                      formatter={(value, name) => [
                        Number(value || 0).toLocaleString("en-NG"),
                        name,
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />

                    <Legend />

                    <Line
                      yAxisId="eggs"
                      type="monotone"
                      dataKey="totalEggs"
                      name="Total Eggs"
                      stroke={COLORS[1]}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLORS[1] }}
                      activeDot={{ r: 7 }}
                      connectNulls
                      isAnimationActive={false}
                    />

                    <Line
                      yAxisId="mortality"
                      type="monotone"
                      dataKey="totalMortality"
                      name="Mortality"
                      stroke={COLORS[3]}
                      strokeWidth={3}
                      dot={{ r: 4, fill: COLORS[3] }}
                      activeDot={{ r: 7 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT TABLE */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {reportType} Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {filteredRecords.length.toLocaleString("en-NG")} record(s) found
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-sm text-gray-600">
              Rows per page
            </label>

            <select
              id="pageSize"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
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
          <div className="p-10 text-center">
            <p className="text-lg font-semibold text-gray-700">
              No records to display
            </p>

            <p className="mt-2 text-sm text-gray-500">
              Try another date range or report type.
            </p>
          </div>
        ) : (
          <>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-left font-semibold text-gray-700"
                      >
                        {column.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedRecords.map((record, index) => (
                    <tr
                      key={
                        record._id ||
                        `${getCalendarDateKey(record.Date)}-${index}`
                      }
                      className="hover:bg-gray-50"
                    >
                      {columns.map((column) => (
                        <td
                          key={column}
                          className="whitespace-nowrap px-4 py-3 text-gray-700"
                        >
                          {column === "Date"
                            ? formatReportDate(record[column])
                            : column === "ProductionPercentage"
                              ? `${getNumber(record[column]).toLocaleString(
                                  "en-NG",
                                  {
                                    maximumFractionDigits: 2,
                                  },
                                )}%`
                              : formatCellValue(record[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row">
              <p className="text-sm text-gray-600">
                Showing{" "}
                {filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1}{" "}
                to {Math.min(page * pageSize, filteredRecords.length)} of{" "}
                {filteredRecords.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="px-2 text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
