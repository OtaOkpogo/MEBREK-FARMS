import { useEffect, useMemo, useState } from "react";
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
  getFeedReport,
  getMortalityReport,
  getVaccinationReport,
  getWarehouseReport,
  getStaffReport,
} from "../services/reportService";

const REPORT_TYPES = [
  "Production",
  "Egg Sales",
  "Feed Usage",
  "Mortality",
  "Vaccination",
  "Warehouse",
  "Staff",
];

const COLORS = [
  "#16a34a",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

// ======================================
// RAW → REPORT-SHAPE TRANSFORMERS
// ======================================
// Some backend endpoints (currently /reports/production) return a bare
// array of Mongoose documents instead of { records, summary, chartData }.
// These transformers compute the summary/chart data on the client so the
// rest of the page can keep assuming the normalized shape. Once an
// endpoint is updated to aggregate server-side, its entry here can be
// removed and the raw response will be used as-is.

const buildProductionSummary = (rows) => {
  const totalEggs = rows.reduce((sum, r) => sum + (r.totalEggs || 0), 0);
  const totalMortality = rows.reduce((sum, r) => sum + (r.mortality || 0), 0);
  const feedConsumed = rows.reduce(
    (sum, r) => sum + (r.feedBagsConsumed || 0),
    0,
  );
  const averageProduction = rows.length
    ? rows.reduce((sum, r) => sum + (r.productionPercentage || 0), 0) /
      rows.length
    : 0;

  return {
    totalEggs,
    averageProduction: Number(averageProduction.toFixed(2)),
    feedConsumed,
    totalMortality,
  };
};

const buildProductionChartData = (rows) => {
  // One point per calendar date, summing totalEggs in case multiple
  // pens logged production on the same day.
  const byDate = {};
  rows.forEach((r) => {
    const label = r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Unknown";
    byDate[label] = (byDate[label] || 0) + (r.totalEggs || 0);
  });
  return Object.entries(byDate).map(([name, value]) => ({ name, value }));
};

const buildProductionRecords = (rows) =>
  rows.map((r) => ({
    Date: r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    Pen: r.pen || "—",
    "Eggs Produced": r.totalEggs ?? 0,
    Crates: r.cratesProduced ?? 0,
    "Cracked Eggs": r.crackedEggs ?? 0,
    Mortality: r.mortality ?? 0,
    "Feed Consumed": r.feedBagsConsumed ?? 0,
    "Production %": r.productionPercentage ?? 0,
  }));

// ---- Egg Sales ----

const buildEggSalesSummary = (rows) => {
  const revenue = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  const amountPaid = rows.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
  const outstanding = rows.reduce((sum, r) => sum + (r.balance || 0), 0);
  const cratesSold = rows.reduce((sum, r) => sum + (r.cratesSold || 0), 0);
  const looseEggsSold = rows.reduce((sum, r) => sum + (r.looseEggs || 0), 0);
  const averageSale = rows.length ? revenue / rows.length : 0;
  const customersServed = new Set(
    rows.map((r) => (r.customer || "").trim().toLowerCase()).filter(Boolean),
  ).size;

  return {
    revenue,
    amountPaid,
    outstanding,
    cratesSold,
    looseEggsSold,
    averageSale: Number(averageSale.toFixed(2)),
    customersServed,
  };
};

const buildEggSalesChartData = (rows) => {
  // One point per calendar date, summing revenue in case of multiple
  // sales on the same day.
  const byDate = {};
  rows.forEach((r) => {
    const label = r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "Unknown";
    byDate[label] = (byDate[label] || 0) + (r.totalAmount || 0);
  });
  return Object.entries(byDate).map(([name, value]) => ({ name, value }));
};

const buildEggSalesRecords = (rows) =>
  rows.map((r) => ({
    Date: r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—",
    Invoice: r.invoiceNumber || "—",
    Customer: r.customer || "—",
    "Crates Sold": r.cratesSold ?? 0,
    "Loose Eggs": r.looseEggs ?? 0,
    Revenue: r.totalAmount ?? 0,
    "Amount Paid": r.amountPaid ?? 0,
    Outstanding: r.balance ?? 0,
    "Payment Method": r.paymentMethod || "—",
    Status: r.status || "—",
  }));

const RAW_ARRAY_TRANSFORMERS = {
  Production: (rows) => ({
    records: buildProductionRecords(rows),
    summary: buildProductionSummary(rows),
    chartData: buildProductionChartData(rows),
  }),
  "Egg Sales": (rows) => ({
    records: buildEggSalesRecords(rows),
    summary: buildEggSalesSummary(rows),
    chartData: buildEggSalesChartData(rows),
  }),
};

/**
 * Normalizes whatever the backend returned into { records, summary, chartData }.
 * - Soft-deleted rows (isDeleted: true) are stripped out first — the
 *   backend currently returns them alongside active records.
 * - If it's already in { records, summary, chartData } shape, pass through.
 * - If it's a bare array (current behavior for Production), run it through
 *   the matching transformer, or fall back to records-only if no
 *   transformer exists yet for that report type.
 */
const normalizeReportResponse = (reportTypeKey, data) => {
  // New object response (Feed Usage and future reports)
  if (!Array.isArray(data) && data) {
    return {
      records: data.tableData || data.records || [],
      summary: data.summary || {},
      chartData: data.chartData || [],
    };
  }

  // Old array response
  if (Array.isArray(data)) {
    const activeRows = data.filter((row) => row?.isDeleted !== true);

    const transform = RAW_ARRAY_TRANSFORMERS[reportTypeKey];

    if (transform) {
      return transform(activeRows);
    }

    return {
      records: activeRows,
      summary: {},
      chartData: [],
    };
  }

  return {
    records: [],
    summary: {},
    chartData: [],
  };
};

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const defaultStartDate = sevenDaysAgo.toISOString().slice(0, 10);

  const [reportType, setReportType] = useState("Production");

  const [startDate, setStartDate] = useState(defaultStartDate);

  const [endDate, setEndDate] = useState(today);

  const [loading, setLoading] = useState(false);

  const [records, setRecords] = useState([]);

  const [chartData, setChartData] = useState([]);

  const [summary, setSummary] = useState({});

  // ======================================
  // LOAD REPORT
  // ======================================

  const loadReport = async () => {
    try {
      setLoading(true);

      let response;

      switch (reportType) {
        case "Production":
          response = await getProductionReport({ startDate, endDate });
          break;

        case "Egg Sales":
          response = await getEggSalesReport({ startDate, endDate });
          break;

        case "Feed Usage":
          response = await getFeedReport({ startDate, endDate });
          break;

        case "Mortality":
          response = await getMortalityReport({ startDate, endDate });
          break;

        case "Vaccination":
          response = await getVaccinationReport({ startDate, endDate });
          break;

        case "Warehouse":
          response = await getWarehouseReport({ startDate, endDate });
          break;

        case "Staff":
          response = await getStaffReport({ startDate, endDate });
          break;

        default:
          response = {
            records: [],
            summary: {},
            chartData: [],
          };
      }

      const normalized = response
        ? normalizeReportResponse(reportType, response)
        : { records: [], summary: {}, chartData: [] };

      setRecords(normalized.records);
      setSummary(normalized.summary);
      setChartData(normalized.chartData);

      if (response && (normalized.records || []).length > 0) {
        toast.success(`${reportType} report generated.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report.");
      setRecords([]);
      setSummary({});
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, startDate, endDate]);

  // ======================================
  // SUMMARY CARDS
  // ======================================

  const cards = useMemo(() => {
    switch (reportType) {
      case "Production":
        return [
          {
            title: "Total Eggs",
            value: summary.totalEggs || 0,
            color: "text-green-600",
          },
          {
            title: "Average Production %",
            value: summary.averageProduction || 0,
            color: "text-blue-600",
          },
          {
            title: "Feed Consumed",
            value: summary.feedConsumed || 0,
            color: "text-orange-600",
          },
          {
            title: "Mortality",
            value: summary.totalMortality || 0,
            color: "text-red-600",
          },
        ];

      case "Egg Sales":
        return [
          {
            title: "Revenue",
            value: summary.revenue || 0,
            color: "text-green-600",
          },
          {
            title: "Amount Paid",
            value: summary.amountPaid || 0,
            color: "text-blue-600",
          },
          {
            title: "Outstanding",
            value: summary.outstanding || 0,
            color: "text-red-600",
          },
          {
            title: "Crates Sold",
            value: summary.cratesSold || 0,
            color: "text-purple-600",
          },
        ];

      case "Feed Usage":
        return [
          {
            title: "Feed Purchased",
            value: summary.feedPurchased || 0,
            color: "text-green-600",
          },
          {
            title: "Feed Used",
            value: summary.feedUsed || 0,
            color: "text-blue-600",
          },
          {
            title: "Current Stock",
            value: summary.stock || 0,
            color: "text-orange-600",
          },
          {
            title: "Low Stock",
            value: summary.lowStock || 0,
            color: "text-red-600",
          },
        ];

      default:
        return [];
    }
  }, [reportType, summary]);

  // ======================================
  // SEARCH + PAGINATION STATE
  // ======================================

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ======================================
  // FILTER RECORDS
  // ======================================

  const filteredRecords = useMemo(() => {
    if (!search) return records;
    const keyword = search.toLowerCase();
    return records.filter((record) =>
      Object.values(record).some((value) =>
        String(value).toLowerCase().includes(keyword),
      ),
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  const paginatedRecords = filteredRecords.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, reportType]);

  // ======================================
  // EXPORT TO EXCEL
  // ======================================

  const exportExcel = () => {
    if (!filteredRecords.length) {
      toast.error("No records to export.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, reportType);

    XLSX.writeFile(
      workbook,
      `${reportType.replace(/\s+/g, "-").toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`,
    );

    toast.success("Excel report exported.");
  };

  // ======================================
  // EXPORT TO PDF
  // ======================================

  const exportPDF = () => {
    if (!filteredRecords.length) {
      toast.error("No records to export.");
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(20);

    doc.text(`${reportType} Report`, 14, 18);

    doc.setFontSize(11);

    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    doc.text(`Period: ${startDate}  →  ${endDate}`, 14, 36);

    const headers = [Object.keys(filteredRecords[0])];

    const rows = filteredRecords.map((record) =>
      Object.values(record).map((value) =>
        typeof value === "object" ? JSON.stringify(value) : String(value),
      ),
    );

    autoTable(doc, {
      startY: 45,
      head: headers,
      body: rows,

      styles: {
        fontSize: 7,
        cellPadding: 2,
      },

      headStyles: {
        fillColor: [22, 163, 74],
      },

      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    doc.save(
      `${reportType.replace(/\s+/g, "-").toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`,
    );

    toast.success("PDF report exported.");
  };

  // ======================================
  // UI
  // ======================================

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">📊 Reports Center</h1>

          <p className="text-gray-500 mt-1">
            Generate and export farm reports.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={exportExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
          >
            Export Excel
          </button>

          <button
            onClick={exportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* FILTERS */}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Report Type
            </label>

            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border rounded-lg p-2"
            >
              {REPORT_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Start Date
            </label>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">End Date</label>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded-lg p-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={loadReport}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl shadow p-5">
            <p className="text-gray-500 text-sm">{card.title}</p>

            <h2 className={`text-3xl font-bold mt-2 ${card.color}`}>
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      {/* ============================
          CHARTS
      ============================ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* BAR CHART */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold mb-4">{reportType} Overview</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#16a34a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* LINE CHART */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-bold mb-4">Trend Analysis</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* PIE CHART */}
      <div className="bg-white rounded-xl shadow p-5 mb-8">
        <h2 className="text-lg font-bold mb-5">{reportType} Distribution</h2>
        <ResponsiveContainer width="100%" height={420}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              outerRadius={150}
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ============================
          SEARCH + TABLE
      ============================ */}

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow p-5 mb-5">
        <div className="flex flex-col lg:flex-row gap-4 justify-between">
          <input
            type="text"
            placeholder="Search report..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg p-3 flex-1"
          />
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="border rounded-lg px-4"
          >
            <option value={10}>10 Rows</option>
            <option value={20}>20 Rows</option>
            <option value={50}>50 Rows</option>
            <option value={100}>100 Rows</option>
          </select>
        </div>
      </div>

      {/* Improved Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-green-600 text-white">
            <tr>
              {paginatedRecords.length > 0 &&
                Object.keys(paginatedRecords[0]).map((key) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left whitespace-nowrap"
                  >
                    {key.replace(/([A-Z])/g, " $1")}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={20} className="text-center p-10 text-gray-500">
                  <div className="py-12 text-center">
                    <div className="text-6xl mb-3">📊</div>
                    <h2 className="text-xl font-bold">No Report Data</h2>
                    <p className="text-gray-500 mt-2">
                      Select another date range or report type.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRecords.map((row, index) => (
                <tr key={index} className="border-b hover:bg-green-50">
                  {Object.values(row).map((value, i) => (
                    <td key={i} className="px-4 py-3 whitespace-nowrap">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white rounded-xl shadow mt-5 p-5">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-5">
          <div className="text-gray-600">
            Showing
            <strong className="mx-2">
              {filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1}
            </strong>
            to
            <strong className="mx-2">
              {Math.min(page * pageSize, filteredRecords.length)}
            </strong>
            of
            <strong className="mx-2">{filteredRecords.length}</strong>
            records
          </div>

          <div className="flex gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="bg-gray-200 px-5 py-2 rounded disabled:opacity-40"
            >
              Previous
            </button>

            <div className="bg-green-600 text-white px-5 py-2 rounded">
              {page} / {totalPages}
            </div>

            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="bg-gray-200 px-5 py-2 rounded disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-10 flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
            <p className="mt-5 font-semibold">Generating Report...</p>
          </div>
        </div>
      )}
    </div>
  );
}
