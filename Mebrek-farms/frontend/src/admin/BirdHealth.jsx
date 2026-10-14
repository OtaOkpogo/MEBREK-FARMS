import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PENS } from "../constants/pens";

import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Plus, Search, RefreshCw } from "lucide-react";

import {
  fetchBirdHealth,
  createBirdHealth,
  updateBirdHealth,
  deleteBirdHealth,
  restoreBirdHealth,
} from "../services/birdHealthService";

import socket from "../services/socket";

// Includes manually entered health categories and records
// synchronized from Medication, Vaccination, and Mortality.
const CATEGORIES = [
  "Respiratory",
  "Digestive",
  "Parasitic",
  "Bacterial",
  "Viral",
  "Nutritional Deficiency",
  "Injury",
  "Other",
  "Medication",
  "Vaccination",
  "Mortality",
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

const STATUS = [
  "Active",
  "Recovering",
  "Recovered",
  "Isolated",
  "Under Treatment",
  "Dead",
];

const STATUS_COLORS = {
  Active: "bg-blue-100 text-blue-700",
  "Under Treatment": "bg-blue-100 text-blue-700",
  Recovering: "bg-yellow-100 text-yellow-700",
  Recovered: "bg-green-100 text-green-700",
  Isolated: "bg-purple-100 text-purple-700",
  Dead: "bg-red-100 text-red-700",
};

const CHART_STATUS_COLORS = {
  Active: "#3B82F6",
  Recovering: "#FACC15",
  Recovered: "#22C55E",
  Critical: "#EF4444",
};

const CATEGORY_COLORS = {
  Medication: "bg-blue-100 text-blue-700",
  Vaccination: "bg-purple-100 text-purple-700",
  Mortality: "bg-red-100 text-red-700",
};

const getApiRecords = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  return null;
};

export default function BirdHealth() {
  const role = localStorage.getItem("role");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    date: new Date().toISOString().slice(0, 10),
    pen: "",
    healthIssue: "",
    category: "",
    birdsAffected: "",
    symptoms: "",
    severity: "Low",
    vetConsulted: false,
    diagnosis: "",
    actionTaken: "",
    medicationUsed: "",
    veterinarianName: "",
    followUpDate: "",
    costOfTreatment: "",
    status: "Active",
    remarks: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedPen, setSelectedPen] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // ===========================
  // LOAD RECORDS
  // ===========================

  const loadRecords = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await fetchBirdHealth();

      console.log("BIRD HEALTH API RESPONSE:", response);

      const data = getApiRecords(response);

      if (!data) {
        console.error("Unexpected Bird Health API response format:", response);
        toast.error("Unexpected response from Bird Health API.");
        return;
      }

      setRecords(data);
    } catch (err) {
      console.error("FAILED TO LOAD BIRD HEALTH:", err?.response?.data || err);
      toast.error("Failed to load bird health records.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // ===========================
  // SAVE RECORD
  // ===========================

  const saveRecord = async (e) => {
    e.preventDefault();

    if (!form.date || !form.pen || !form.healthIssue.trim()) {
      toast.error("Please complete the date, pen, and health issue.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        healthIssue: form.healthIssue.trim(),
        birdsAffected:
          form.birdsAffected === "" ? 0 : Number(form.birdsAffected),
        costOfTreatment:
          form.costOfTreatment === "" ? 0 : Number(form.costOfTreatment),
        category: form.category || undefined,
        followUpDate: form.followUpDate || null,
      };

      if (editingId) {
        await updateBirdHealth(editingId, payload);
        toast.success("Bird health record updated.");
      } else {
        await createBirdHealth(payload);
        toast.success("Bird health record created.");
      }

      setEditingId(null);
      setForm({
        ...emptyForm,
        date: new Date().toISOString().slice(0, 10),
      });

      await loadRecords(false);
    } catch (err) {
      console.error("SAVE BIRD HEALTH ERROR:", err?.response?.data || err);

      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Unable to save record.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ===========================
  // EDIT RECORD
  // ===========================

  const editRecord = (record) => {
    setEditingId(record._id);

    setForm({
      ...emptyForm,
      ...record,
      date: record.date?.substring(0, 10) || "",
      followUpDate: record.followUpDate?.substring(0, 10) || "",
      birdsAffected: record.birdsAffected ?? "",
      costOfTreatment: record.costOfTreatment ?? "",
      vetConsulted: Boolean(record.vetConsulted),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  // ===========================
  // DELETE RECORD
  // ===========================

  const removeRecord = async (id) => {
    if (!window.confirm("Delete this bird health record?")) return;

    try {
      await deleteBirdHealth(id);
      toast.success("Record deleted.");
      await loadRecords(false);
    } catch (err) {
      console.error("DELETE BIRD HEALTH ERROR:", err?.response?.data || err);
      toast.error("Delete failed.");
    }
  };

  // ===========================
  // RESTORE RECORD
  // ===========================

  const restoreRecord = async (id) => {
    try {
      await restoreBirdHealth(id);
      toast.success("Record restored.");
      await loadRecords(false);
    } catch (err) {
      console.error("RESTORE BIRD HEALTH ERROR:", err?.response?.data || err);
      toast.error("Restore failed.");
    }
  };

  // ===========================
  // EXPORTS
  // ===========================

  const exportExcel = () => {
    const exportRows = filteredRecords.map((r) => ({
      Date: r.date ? new Date(r.date).toLocaleDateString() : "",
      Pen: r.pen || "",
      Category: r.category || "Other",
      Issue: r.healthIssue || "",
      BirdsAffected: r.birdsAffected ?? 0,
      Severity: r.severity || "",
      Status: r.status || "",
      Symptoms: r.symptoms || "",
      Diagnosis: r.diagnosis || "",
      Treatment: r.actionTaken || "",
      Medication: r.medicationUsed || "",
      FollowUp: r.followUpStatus || "",
      Remarks: r.remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Bird Health");
    XLSX.writeFile(workbook, "BirdHealthReport.xlsx");

    toast.success("Excel exported.");
  };

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Bird Health Report", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [
        ["Date", "Pen", "Category", "Issue", "Affected", "Severity", "Status"],
      ],
      body: filteredRecords.map((r) => [
        r.date ? new Date(r.date).toLocaleDateString() : "",
        r.pen || "",
        r.category || "Other",
        r.healthIssue || "",
        r.birdsAffected ?? 0,
        r.severity || "",
        r.status || "",
      ]),
    });

    doc.save("BirdHealthReport.pdf");
    toast.success("PDF exported.");
  };

  const printReport = () => window.print();

  // ===========================
  // SUMMARY
  // ===========================

  const stats = useMemo(
    () => ({
      total: records.length,

      active: records.filter(
        (r) => r.status === "Active" || r.status === "Under Treatment",
      ).length,

      recovering: records.filter((r) => r.status === "Recovering").length,

      recovered: records.filter((r) => r.status === "Recovered").length,

      // FIX: Sum the number of birds, not the number of records.
      // Counts birds from records marked Critical or Dead.
      critical: records
        .filter((r) => r.status === "Dead" || r.severity === "Critical")
        .reduce((total, r) => total + Number(r.birdsAffected || 0), 0),
    }),
    [records],
  );

  const chartData = [
    { name: "Active", value: stats.active },
    { name: "Recovering", value: stats.recovering },
    { name: "Recovered", value: stats.recovered },
    { name: "Critical", value: stats.critical },
  ];

  // ===========================
  // SOCKET EVENTS
  // ===========================

  useEffect(() => {
    loadRecords();

    const refreshRecords = () => {
      loadRecords(false);
    };

    socket.on("birdHealthCreated", refreshRecords);
    socket.on("birdHealthUpdated", refreshRecords);
    socket.on("birdHealthDeleted", refreshRecords);
    socket.on("birdHealthRestored", refreshRecords);

    return () => {
      socket.off("birdHealthCreated", refreshRecords);
      socket.off("birdHealthUpdated", refreshRecords);
      socket.off("birdHealthDeleted", refreshRecords);
      socket.off("birdHealthRestored", refreshRecords);
    };

    // Initial load and socket subscription are intentionally mounted once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===========================
  // FILTER RECORDS
  // ===========================

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        !query ||
        record.healthIssue?.toLowerCase().includes(query) ||
        record.symptoms?.toLowerCase().includes(query) ||
        record.diagnosis?.toLowerCase().includes(query) ||
        record.pen?.toLowerCase().includes(query) ||
        record.medicationUsed?.toLowerCase().includes(query) ||
        record.category?.toLowerCase().includes(query);

      const matchesPen = selectedPen === "All" || record.pen === selectedPen;

      const matchesSeverity =
        selectedSeverity === "All" || record.severity === selectedSeverity;

      const matchesStatus =
        selectedStatus === "All" || record.status === selectedStatus;

      const matchesCategory =
        selectedCategory === "All" ||
        (record.category || "Other") === selectedCategory;

      return (
        matchesSearch &&
        matchesPen &&
        matchesSeverity &&
        matchesStatus &&
        matchesCategory
      );
    });
  }, [
    records,
    search,
    selectedPen,
    selectedSeverity,
    selectedStatus,
    selectedCategory,
  ]);

  // ===========================
  // RENDER
  // ===========================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Bird Health Management
          </h1>

          <p className="text-gray-500">
            Monitor health issues, treatments, vaccinations, and mortality.
          </p>

          <p className="text-sm text-gray-500 mt-1">
            {stats.total} total record{stats.total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => loadRecords()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            type="button"
            onClick={exportExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            Excel
          </button>

          <button
            type="button"
            onClick={exportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            PDF
          </button>

          <button
            type="button"
            onClick={printReport}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg"
          >
            Print
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gray-100 rounded-xl shadow p-4">
          <p className="text-gray-700 text-sm font-semibold">Total Records</p>
          <h2 className="text-3xl font-bold text-gray-800">{stats.total}</h2>
        </div>

        <div className="bg-blue-100 rounded-xl shadow p-4">
          <p className="text-blue-700 text-sm font-semibold">Active</p>
          <h2 className="text-3xl font-bold text-blue-800">{stats.active}</h2>
        </div>

        <div className="bg-yellow-100 rounded-xl shadow p-4">
          <p className="text-yellow-700 text-sm font-semibold">Recovering</p>
          <h2 className="text-3xl font-bold text-yellow-800">
            {stats.recovering}
          </h2>
        </div>

        <div className="bg-green-100 rounded-xl shadow p-4">
          <p className="text-green-700 text-sm font-semibold">Recovered</p>
          <h2 className="text-3xl font-bold text-green-800">
            {stats.recovered}
          </h2>
        </div>

        <div className="bg-red-100 rounded-xl shadow p-4">
          <p className="text-red-700 text-sm font-semibold">Critical / Dead</p>
          <h2 className="text-3xl font-bold text-red-800">{stats.critical}</h2>
        </div>
      </div>

      {/* CHART */}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-bold mb-4">Bird Health Overview</h2>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />

              <Bar dataKey="value">
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CHART_STATUS_COLORS[entry.name] || "#9CA3AF"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FILTERS */}

      <div className="bg-white rounded-xl shadow p-5">
        <div className="grid md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />

            <input
              type="text"
              placeholder="Search issue, pen, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded-lg w-full pl-10 pr-3 py-2"
            />
          </div>

          <select
            value={selectedPen}
            onChange={(e) => setSelectedPen(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option value="All">All Pens</option>
            {PENS.map((pen) => (
              <option key={pen} value={pen}>
                {pen}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option value="All">All Severities</option>
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option value="All">All Statuses</option>
            {STATUS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p className="text-sm text-gray-500">
            Showing {filteredRecords.length} of {records.length} records
          </p>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedPen("All");
              setSelectedCategory("All");
              setSelectedSeverity("All");
              setSelectedStatus("All");
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        </div>
      </div>

      {/* FORM */}

      <form onSubmit={saveRecord} className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold">
            {editingId ? "Edit Bird Health Record" : "New Bird Health Record"}
          </h2>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="border rounded-lg p-2"
            required
          />

          <select
            value={form.pen}
            onChange={(e) => setForm({ ...form, pen: e.target.value })}
            className="border rounded-lg p-2"
            required
          >
            <option value="">Select Pen</option>
            {PENS.map((pen) => (
              <option key={pen} value={pen}>
                {pen}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Disease / Health Issue"
            value={form.healthIssue}
            onChange={(e) => setForm({ ...form, healthIssue: e.target.value })}
            className="border rounded-lg p-2"
            required
          />

          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="border rounded-lg p-2"
          >
            <option value="">Select Category</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            placeholder="Birds Affected"
            value={form.birdsAffected}
            onChange={(e) =>
              setForm({ ...form, birdsAffected: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <select
            value={form.severity}
            onChange={(e) => setForm({ ...form, severity: e.target.value })}
            className="border rounded-lg p-2"
          >
            {SEVERITIES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 border rounded-lg p-2">
            <input
              type="checkbox"
              checked={form.vetConsulted}
              onChange={(e) =>
                setForm({ ...form, vetConsulted: e.target.checked })
              }
            />
            Veterinarian consulted
          </label>

          <textarea
            placeholder="Symptoms"
            value={form.symptoms}
            onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <textarea
            placeholder="Diagnosis"
            value={form.diagnosis}
            onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <textarea
            placeholder="Treatment Given / Action Taken"
            value={form.actionTaken}
            onChange={(e) => setForm({ ...form, actionTaken: e.target.value })}
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <input
            type="text"
            placeholder="Medication Used"
            value={form.medicationUsed}
            onChange={(e) =>
              setForm({ ...form, medicationUsed: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="text"
            placeholder="Veterinarian Name"
            value={form.veterinarianName}
            onChange={(e) =>
              setForm({ ...form, veterinarianName: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="date"
            value={form.followUpDate}
            onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            className="border rounded-lg p-2"
          />

          <input
            type="number"
            min="0"
            placeholder="Treatment Cost (NGN)"
            value={form.costOfTreatment}
            onChange={(e) =>
              setForm({ ...form, costOfTreatment: e.target.value })
            }
            className="border rounded-lg p-2"
          />

          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="border rounded-lg p-2"
          >
            {STATUS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            className="border rounded-lg p-2 md:col-span-3"
            rows={3}
          />
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-6 py-3 rounded-lg"
          >
            <Plus size={18} />
            {saving ? "Saving..." : editingId ? "Update Record" : "Save Record"}
          </button>
        </div>
      </form>

      {/* RECORDS TABLE */}

      {loading ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-gray-500">Loading bird health records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-gray-500">No bird health records found.</p>

          {records.length > 0 && (
            <p className="text-sm text-gray-400 mt-2">
              Try clearing the filters to see all records.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr className="text-left">
                <th className="p-3">Date</th>
                <th className="p-3">Pen</th>
                <th className="p-3">Issue</th>
                <th className="p-3">Affected</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Follow Up</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr
                  key={record._id}
                  className={`border-t hover:bg-gray-50 ${
                    record.isDeleted ? "bg-red-50 opacity-80" : ""
                  }`}
                >
                  <td className="p-3 whitespace-nowrap">
                    {record.date
                      ? new Date(record.date).toLocaleDateString()
                      : "-"}
                  </td>

                  <td className="p-3 whitespace-nowrap">{record.pen || "-"}</td>

                  <td className="p-3 min-w-48">
                    <div className="font-medium">
                      {record.healthIssue || "-"}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs ${
                          CATEGORY_COLORS[record.category] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {record.category || "Other"}
                      </span>

                      {record.isDeleted && (
                        <span className="inline-block px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                          Deleted
                        </span>
                      )}
                    </div>

                    {record.symptoms && (
                      <div className="text-xs text-gray-500 mt-1">
                        {record.symptoms}
                      </div>
                    )}
                  </td>

                  <td className="p-3">{record.birdsAffected ?? 0}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        record.severity === "Critical"
                          ? "bg-red-100 text-red-700"
                          : record.severity === "High"
                            ? "bg-orange-100 text-orange-700"
                            : record.severity === "Medium"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-green-100 text-green-700"
                      }`}
                    >
                      {record.severity || "-"}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        STATUS_COLORS[record.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {record.status || "-"}
                    </span>
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {record.followUpStatus ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          record.followUpStatus === "Overdue"
                            ? "bg-red-100 text-red-700"
                            : record.followUpStatus === "Due Today"
                              ? "bg-yellow-100 text-yellow-700"
                              : record.followUpStatus === "Upcoming"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                        }`}
                      >
                        {record.followUpStatus}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td className="p-3">
                    <div className="flex justify-center items-center gap-2">
                      {(role === "manager" || role === "superadmin") &&
                        !record.isDeleted && (
                          <>
                            <button
                              type="button"
                              onClick={() => editRecord(record)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => removeRecord(record._id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                            >
                              Delete
                            </button>
                          </>
                        )}

                      {role === "superadmin" && record.isDeleted && (
                        <div className="flex flex-col items-start gap-2">
                          <div className="text-xs text-gray-500">
                            Deleted by{" "}
                            {record.deletedBy?.name ||
                              record.deletedByName ||
                              "Unknown"}
                            {(record.deletedBy?.role ||
                              record.deletedByRole) && (
                              <span>
                                {" "}
                                (
                                {record.deletedBy?.role || record.deletedByRole}
                                )
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => restoreRecord(record._id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Restore
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
