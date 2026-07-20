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

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);

  const [reportType, setReportType] = useState("Production");

  const [startDate, setStartDate] = useState(today);

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
          response = await getProductionReport(startDate, endDate);
          break;

        case "Egg Sales":
          response = await getEggSalesReport(startDate, endDate);
          break;

        case "Feed Usage":
          response = await getFeedReport(startDate, endDate);
          break;

        case "Mortality":
          response = await getMortalityReport(startDate, endDate);
          break;

        case "Vaccination":
          response = await getVaccinationReport(startDate, endDate);
          break;

        case "Warehouse":
          response = await getWarehouseReport(startDate, endDate);
          break;

        case "Staff":
          response = await getStaffReport(startDate, endDate);
          break;

        default:
          response = {
            records: [],
            summary: {},
            chartData: [],
          };
      }

      setRecords(response.records || []);
      setSummary(response.summary || {});
      setChartData(response.chartData || []);

      toast.success(`${reportType} report generated.`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

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
  // EXPORT PLACEHOLDERS
  // (implemented in Part 4)
  // ======================================

  const exportExcel = () => {};

  const exportPDF = () => {};

  // ======================================
  // UI
  // ======================================

  return (
    <div className="p-6">

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">

        <div>
          <h1 className="text-3xl font-bold">
            📊 Reports Center
          </h1>

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
                <option key={type}>
                  {type}
                </option>
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

            <label className="block text-sm font-semibold mb-2">
              End Date
            </label>

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

          <div
            key={card.title}
            className="bg-white rounded-xl shadow p-5"
          >
            <p className="text-gray-500 text-sm">
              {card.title}
            </p>

            <h2 className={`text-3xl font-bold mt-2 ${card.color}`}>
              {card.value}
            </h2>

          </div>

        ))}

      </div>

      {/* PART 2:
          Charts start here
      */}

    </div>
  );
}
