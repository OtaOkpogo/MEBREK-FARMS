import { useCallback, useEffect, useMemo, useState } from "react";
import { PENS } from "../constants/pens";

import {
  fetchMortality,
  createMortality,
  deleteMortality,
} from "../services/mortalityService";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";

const CAUSES = [
  "Disease",
  "Predator Attack",
  "Heat Stress",
  "Cold Stress",
  "Cannibalism",
  "Accident",
  "Poisoning",
  "Unknown",
  "Other",
];

const COLORS = [
  "#b45353",
  "#d97745",
  "#d4a64b",
  "#6d9875",
  "#6387a5",
  "#8b78a8",
  "#a17b64",
  "#718096",
  "#9a9a78",
];

const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getNumericValue = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (amount) =>
  `₦${getNumericValue(amount).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

const formatDate = (date) => {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getRecordsFromResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.mortality)) return response.mortality;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.records)) return response.data.records;
  if (Array.isArray(response?.data?.mortality)) {
    return response.data.mortality;
  }

  return [];
};

const initialForm = () => ({
  birdBatch: "",
  numberDead: "",
  cause: "",
  estimatedLoss: "",
  notes: "",
  date: getToday(),
});

export default function Mortality() {
  const [records, setRecords] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================================================
  // LOAD MORTALITY RECORDS
  // ============================================================

  const loadMortality = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetchMortality();

      setRecords(getRecordsFromResponse(response));
    } catch (err) {
      console.error("Mortality loading error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load mortality records. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMortality();
  }, [loadMortality]);

  // ============================================================
  // FORM HANDLING
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // ============================================================
  // CREATE MORTALITY RECORD
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const numberDead = Number(formData.numberDead);
    const estimatedLoss =
      formData.estimatedLoss === "" ? 0 : Number(formData.estimatedLoss);

    if (!formData.birdBatch || !formData.date || !formData.cause) {
      setError("Please complete all required fields.");
      return;
    }

    if (!Number.isInteger(numberDead) || numberDead <= 0) {
      setError("Number of dead birds must be a positive whole number.");
      return;
    }

    if (!Number.isFinite(estimatedLoss) || estimatedLoss < 0) {
      setError("Estimated financial loss must be a valid non-negative amount.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        birdBatch: formData.birdBatch,
        numberDead,
        cause: formData.cause,
        estimatedLoss,
        notes: formData.notes.trim(),
        date: formData.date,
      };

      await createMortality(payload);

      setFormData(initialForm());
      setSuccess("Mortality record saved successfully.");

      await loadMortality();
    } catch (err) {
      console.error("Mortality save error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to save mortality record. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // DELETE MORTALITY RECORD
  // ============================================================

  const handleDelete = async (id) => {
    if (!id || deletingId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this mortality record?",
    );

    if (!confirmed) return;

    try {
      setDeletingId(id);
      setError("");
      setSuccess("");

      await deleteMortality(id);

      setSuccess("Mortality record deleted successfully.");

      await loadMortality();
    } catch (err) {
      console.error("Mortality deletion error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to delete this mortality record.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================
  // ANALYTICS
  // ============================================================

  const totalDeaths = useMemo(
    () =>
      records.reduce((sum, item) => sum + getNumericValue(item.numberDead), 0),
    [records],
  );

  const totalLoss = useMemo(
    () =>
      records.reduce(
        (sum, item) => sum + getNumericValue(item.estimatedLoss),
        0,
      ),
    [records],
  );

  const totalRecords = records.length;

  const mostCommonCause = useMemo(() => {
    if (!records.length) return "—";

    const causeTotals = {};

    records.forEach((item) => {
      const cause = item.cause || "Unknown";

      causeTotals[cause] =
        (causeTotals[cause] || 0) + getNumericValue(item.numberDead);
    });

    return (
      Object.entries(causeTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || "—"
    );
  }, [records]);

  // ============================================================
  // CHART DATA
  // ============================================================

  const causeChartData = useMemo(() => {
    const causeTotals = {};

    records.forEach((item) => {
      const cause = item.cause || "Unknown";

      causeTotals[cause] =
        (causeTotals[cause] || 0) + getNumericValue(item.numberDead);
    });

    return Object.entries(causeTotals)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [records]);

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) return records;

    return records.filter((record) => {
      return [
        record.birdBatch,
        record.cause,
        record.notes,
        record.numberDead,
        record.date,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(search),
      );
    });
  }, [records, searchTerm]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f5f7f3] p-4 sm:p-6 lg:p-8">
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#71856e]">
              Farm Management / Poultry Health
            </p>

            <h1 className="text-2xl font-bold text-[#304b37] sm:text-3xl">
              Mortality Tracking
            </h1>

            <p className="mt-2 text-sm text-gray-600 sm:text-base">
              Monitor bird deaths, identify possible causes and track associated
              financial losses.
            </p>
          </div>

          <button
            type="button"
            onClick={loadMortality}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#d8e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#426348] transition hover:bg-[#eef4ec] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={loading ? "animate-spin" : ""}>↻</span>
            Refresh Records
          </button>
        </div>
      </div>

      {/* FEEDBACK */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {/* STATISTICS */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#eadada] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Total Bird Deaths
            </p>
            <span className="rounded-xl bg-red-50 p-2 text-lg">🐔</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#b45353]">
            {totalDeaths.toLocaleString("en-NG")}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Across all recorded entries
          </p>
        </div>

        <div className="rounded-2xl border border-[#e8dfd0] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Estimated Financial Loss
            </p>
            <span className="rounded-xl bg-orange-50 p-2 text-lg">₦</span>
          </div>

          <p className="mt-3 text-2xl font-bold text-[#b77943] sm:text-3xl">
            {formatCurrency(totalLoss)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Combined estimated losses
          </p>
        </div>

        <div className="rounded-2xl border border-[#dce5d9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Mortality Records
            </p>
            <span className="rounded-xl bg-[#edf3eb] p-2 text-lg">📋</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#426348]">
            {totalRecords.toLocaleString("en-NG")}
          </p>

          <p className="mt-1 text-xs text-gray-500">Total recorded incidents</p>
        </div>

        <div className="rounded-2xl border border-[#e2dced] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Leading Cause</p>
            <span className="rounded-xl bg-purple-50 p-2 text-lg">🔎</span>
          </div>

          <p className="mt-3 break-words text-xl font-bold text-[#78618f]">
            {mostCommonCause}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Cause with the highest recorded deaths
          </p>
        </div>
      </div>

      {/* ADD RECORD FORM */}
      <div className="mb-8 rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#304b37]">
            Add Mortality Record
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Enter the details of the mortality incident.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          <div>
            <label
              htmlFor="birdBatch"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Pen <span className="text-red-500">*</span>
            </label>

            <select
              id="birdBatch"
              name="birdBatch"
              value={formData.birdBatch}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              required
            >
              <option value="">Select Pen</option>

              {PENS.map((pen) => (
                <option key={pen} value={pen}>
                  {pen}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="date"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Date of Mortality <span className="text-red-500">*</span>
            </label>

            <input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              max={getToday()}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              required
            />
          </div>

          <div>
            <label
              htmlFor="numberDead"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Number of Dead Birds <span className="text-red-500">*</span>
            </label>

            <input
              id="numberDead"
              name="numberDead"
              type="number"
              min="1"
              step="1"
              placeholder="Enter number of dead birds"
              value={formData.numberDead}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              required
            />
          </div>

          <div>
            <label
              htmlFor="cause"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Cause of Death <span className="text-red-500">*</span>
            </label>

            <select
              id="cause"
              name="cause"
              value={formData.cause}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              required
            >
              <option value="">Select Cause</option>

              {CAUSES.map((cause) => (
                <option key={cause} value={cause}>
                  {cause}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="estimatedLoss"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Estimated Financial Loss (₦)
            </label>

            <input
              id="estimatedLoss"
              name="estimatedLoss"
              type="number"
              min="0"
              step="0.01"
              placeholder="Enter estimated financial loss"
              value={formData.estimatedLoss}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="notes"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              Notes / Additional Observations
            </label>

            <textarea
              id="notes"
              name="notes"
              placeholder="Describe any symptoms, observations or additional details..."
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
            />
          </div>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#527b58] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#426748] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving Record..." : "Save Mortality Record"}
            </button>

            <button
              type="button"
              onClick={() => {
                setFormData(initialForm());
                setError("");
                setSuccess("");
              }}
              disabled={saving}
              className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
            >
              Clear Form
            </button>
          </div>
        </form>
      </div>

      {/* CHARTS */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* PIE CHART */}
        <div className="rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#304b37]">Mortality Causes</h2>

          <p className="mb-4 mt-1 text-sm text-gray-500">
            Distribution of recorded deaths by cause.
          </p>

          {causeChartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
              No mortality data available for the chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={causeChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={95}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {causeChartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString("en-NG"),
                    "Deaths",
                  ]}
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* BAR CHART */}
        <div className="rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#304b37]">Deaths by Cause</h2>

          <p className="mb-4 mt-1 text-sm text-gray-500">
            Compare the number of deaths associated with each cause.
          </p>

          {causeChartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
              No mortality data available for the chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={causeChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 35 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#edf0eb"
                />

                <XAxis
                  dataKey="name"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />

                <Tooltip
                  formatter={(value) => [
                    Number(value).toLocaleString("en-NG"),
                    "Deaths",
                  ]}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                  }}
                />

                <Bar
                  dataKey="value"
                  name="Deaths"
                  fill="#b96b65"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* MORTALITY RECORDS TABLE */}
      <div className="rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#304b37]">
              Mortality Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View and manage recorded mortality incidents.
            </p>
          </div>

          <div className="w-full sm:max-w-xs">
            <input
              type="search"
              placeholder="Search pen, cause, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Loading mortality records...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-xl bg-[#f7f9f5] px-4 py-12 text-center">
            <p className="font-semibold text-gray-600">
              {records.length === 0
                ? "No mortality records found."
                : "No records match your search."}
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Mortality records will appear here when available.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-[#e5eae2] bg-[#f7f9f5] text-xs uppercase tracking-wide text-gray-500">
                  <th className="rounded-l-lg px-4 py-4">Pen</th>
                  <th className="px-4 py-4">Deaths</th>
                  <th className="px-4 py-4">Cause</th>
                  <th className="px-4 py-4">Estimated Loss</th>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Notes</th>
                  <th className="rounded-r-lg px-4 py-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record._id}
                    className="border-b border-gray-100 transition hover:bg-[#fafbf8]"
                  >
                    <td className="px-4 py-4 font-semibold text-gray-700">
                      {record.birdBatch || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-[#b45353]">
                        {getNumericValue(record.numberDead).toLocaleString(
                          "en-NG",
                        )}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-700">
                      {record.cause || "—"}
                    </td>

                    <td className="px-4 py-4 font-semibold text-[#a66a43]">
                      {formatCurrency(record.estimatedLoss)}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatDate(record.date)}
                    </td>

                    <td className="max-w-[220px] px-4 py-4 text-sm text-gray-500">
                      <span
                        className="block truncate"
                        title={record.notes || ""}
                      >
                        {record.notes || "—"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => handleDelete(record._id)}
                        disabled={
                          deletingId === record._id || Boolean(deletingId)
                        }
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === record._id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
            Showing {filteredRecords.length} of {records.length} mortality
            records.
          </div>
        )}
      </div>
    </div>
  );
}
