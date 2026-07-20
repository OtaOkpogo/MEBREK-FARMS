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

import { Plus, Search } from "lucide-react";

import {
  fetchBirdHealth,
  createBirdHealth,
  updateBirdHealth,
  deleteBirdHealth,
  restoreBirdHealth,
} from "../services/birdHealthService";

import socket from "../services/socket";

const CATEGORIES = [
  "Respiratory",
  "Digestive",
  "Parasitic",
  "Bacterial",
  "Viral",
  "Nutritional Deficiency",
  "Injury",
  "Other",
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
  Recovering: "bg-yellow-100 text-yellow-700",
  Recovered: "bg-green-100 text-green-700",
  Critical: "bg-red-100 text-red-700",
};

// Hex version for the chart specifically — Recharts' <Cell fill> needs a
// real color value, not a Tailwind class, so this is kept separate from
// the STATUS_COLORS map above rather than reusing that name.
const CHART_STATUS_COLORS = {
  Active: "#3B82F6",
  Recovering: "#FACC15",
  Recovered: "#22C55E",
  Critical: "#EF4444",
};

export default function BirdHealth() {
  const role = localStorage.getItem("role");

  // ===========================
  // DATA
  // ===========================

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  // ===========================
  // FORM
  // ===========================

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

  // ===========================
  // FILTERS
  // ===========================

  const [search, setSearch] = useState("");

  const [selectedPen, setSelectedPen] = useState("All");

  const [selectedSeverity, setSelectedSeverity] = useState("All");

  const [selectedStatus, setSelectedStatus] = useState("All");

  // ===========================
  // LOAD RECORDS
  // ===========================

  const loadRecords = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const data = await fetchBirdHealth();

      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);

      toast.error("Failed to load bird health records.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  // ===========================
  // SAVE
  // ===========================

  const saveRecord = async (e) => {
    e.preventDefault();

    if (!form.pen || !form.healthIssue || !form.date) {
      toast.error("Please complete all required fields.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateBirdHealth(editingId, form);

        toast.success("Bird health record updated.");
      } else {
        await createBirdHealth(form);

        toast.success("Bird health record created.");
      }

      setEditingId(null);

      setForm(emptyForm);

      await loadRecords(false);
    } catch (err) {
      console.error(err);

      toast.error(err?.response?.data?.error || "Unable to save record.");
    } finally {
      setSaving(false);
    }
  };

  // ===========================
  // EDIT
  // ===========================

  const editRecord = (record) => {
    setEditingId(record._id);

    setForm({
      ...emptyForm,
      ...record,
      date: record.date?.substring(0, 10) || "",
      followUpDate: record.followUpDate?.substring(0, 10) || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ===========================
  // DELETE
  // ===========================

  const removeRecord = async (id) => {
    if (!window.confirm("Delete this bird health record?")) return;

    try {
      await deleteBirdHealth(id);

      toast.success("Record deleted.");

      loadRecords(false);
    } catch (err) {
      console.error(err);

      toast.error("Delete failed.");
    }
  };

  // ===========================
  // RESTORE
  // ===========================

  const restoreRecord = async (id) => {
    try {
      await restoreBirdHealth(id);

      toast.success("Record restored.");

      loadRecords(false);
    } catch (err) {
      console.error(err);

      toast.error("Restore failed.");
    }
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(records);

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

      head: [["Date", "Pen", "Issue", "Affected", "Severity", "Status"]],

      body: records.map((r) => [
        new Date(r.date).toLocaleDateString(),
        r.pen,
        r.healthIssue,
        r.birdsAffected,
        r.severity,
        r.status,
      ]),
    });

    doc.save("BirdHealthReport.pdf");

    toast.success("PDF exported.");
  };

  const printReport = () => {
    window.print();
  };

  // ===========================
  // SUMMARY
  // ===========================

  const stats = useMemo(() => {
    return {
      total: records.length,

      // "Active" and "Under Treatment" are treated as the same bucket,
      // since the status enum keeps both values as a superset.
      active: records.filter(
        (r) => r.status === "Active" || r.status === "Under Treatment",
      ).length,

      recovering: records.filter((r) => r.status === "Recovering").length,

      recovered: records.filter((r) => r.status === "Recovered").length,

      critical: records.filter((r) => r.severity === "Critical").length,
    };
  }, [records]);

  const chartData = [
    {
      name: "Active",
      value: stats.active,
    },
    {
      name: "Recovering",
      value: stats.recovering,
    },
    {
      name: "Recovered",
      value: stats.recovered,
    },
    {
      name: "Critical",
      value: stats.critical,
    },
  ];

  // ===========================
  // SOCKET EVENTS
  // ===========================

  useEffect(() => {
    loadRecords();

    socket.on("birdHealthCreated", (record) => {
      console.log("SOCKET: birdHealthCreated received", record);
      loadRecords(false);
    });

    socket.on("birdHealthUpdated", (record) => {
      console.log("SOCKET: birdHealthUpdated received", record);
      loadRecords(false);
    });

    socket.on("birdHealthDeleted", (record) => {
      console.log("SOCKET: birdHealthDeleted received", record);
      loadRecords(false);
    });

    socket.on("birdHealthRestored", (record) => {
      console.log("SOCKET: birdHealthRestored received", record);
      loadRecords(false);
    });

    return () => {
      socket.off("birdHealthCreated");

      socket.off("birdHealthUpdated");

      socket.off("birdHealthDeleted");

      socket.off("birdHealthRestored");
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        search === "" ||
        record.healthIssue?.toLowerCase().includes(search.toLowerCase()) ||
        record.symptoms?.toLowerCase().includes(search.toLowerCase()) ||
        record.diagnosis?.toLowerCase().includes(search.toLowerCase()) ||
        record.pen?.toLowerCase().includes(search.toLowerCase());

      const matchesPen = selectedPen === "All" || record.pen === selectedPen;

      const matchesSeverity =
        selectedSeverity === "All" || record.severity === selectedSeverity;

      const matchesStatus =
        selectedStatus === "All" || record.status === selectedStatus;

      return matchesSearch && matchesPen && matchesSeverity && matchesStatus;
    });
  }, [records, search, selectedPen, selectedSeverity, selectedStatus]);

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Bird Health Management
          </h1>

          <p className="text-gray-500">
            Monitor diseases, treatments and bird health records.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            Excel
          </button>

          <button
            onClick={exportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
          >
            PDF
          </button>

          <button
            onClick={printReport}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg"
          >
            Print
          </button>
        </div>
      </div>

      {/* ================= SUMMARY ================= */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <p className="text-red-700 text-sm font-semibold">Critical</p>
          <h2 className="text-3xl font-bold text-red-800">{stats.critical}</h2>
        </div>
      </div>

      {/* ================= CHART ================= */}

      <div className="bg-white rounded-xl shadow p-5">
        <h2 className="text-xl font-bold mb-4">Bird Health Overview</h2>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="name" />

              <YAxis />

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

      {/* ================= FILTERS ================= */}

      <div className="bg-white rounded-xl shadow p-5">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />

            <input
              type="text"
              placeholder="Search..."
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
            <option>All</option>

            {PENS.map((pen) => (
              <option key={pen}>{pen}</option>
            ))}
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option>All</option>

            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border rounded-lg p-2"
          >
            <option>All</option>

            {STATUS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= FORM ================= */}

      <form onSubmit={saveRecord} className="bg-white rounded-xl shadow p-6">
        <h2 className="text-xl font-bold mb-5">
          {editingId ? "Edit Bird Health Record" : "New Bird Health Record"}
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          <input
            type="date"
            value={form.date}
            onChange={(e) =>
              setForm({
                ...form,
                date: e.target.value,
              })
            }
            className="border rounded-lg p-2"
            required
          />

          <select
            value={form.pen}
            onChange={(e) =>
              setForm({
                ...form,
                pen: e.target.value,
              })
            }
            className="border rounded-lg p-2"
            required
          >
            <option value="">Select Pen</option>

            {PENS.map((pen) => (
              <option key={pen}>{pen}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Disease / Health Issue"
            value={form.healthIssue}
            onChange={(e) =>
              setForm({
                ...form,
                healthIssue: e.target.value,
              })
            }
            className="border rounded-lg p-2"
            required
          />

          <select
            value={form.category}
            onChange={(e) =>
              setForm({
                ...form,
                category: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          >
            <option value="">Category</option>

            {CATEGORIES.map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Birds Affected"
            value={form.birdsAffected}
            onChange={(e) =>
              setForm({
                ...form,
                birdsAffected: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          />

          <select
            value={form.severity}
            onChange={(e) =>
              setForm({
                ...form,
                severity: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          >
            {SEVERITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <textarea
            placeholder="Symptoms"
            value={form.symptoms}
            onChange={(e) =>
              setForm({
                ...form,
                symptoms: e.target.value,
              })
            }
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <textarea
            placeholder="Diagnosis"
            value={form.diagnosis}
            onChange={(e) =>
              setForm({
                ...form,
                diagnosis: e.target.value,
              })
            }
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <textarea
            placeholder="Treatment Given"
            value={form.actionTaken}
            onChange={(e) =>
              setForm({
                ...form,
                actionTaken: e.target.value,
              })
            }
            className="border rounded-lg p-2 md:col-span-3"
            rows={2}
          />

          <input
            type="text"
            placeholder="Medication Used"
            value={form.medicationUsed}
            onChange={(e) =>
              setForm({
                ...form,
                medicationUsed: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="text"
            placeholder="Veterinarian"
            value={form.veterinarianName}
            onChange={(e) =>
              setForm({
                ...form,
                veterinarianName: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="date"
            value={form.followUpDate}
            onChange={(e) =>
              setForm({
                ...form,
                followUpDate: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          />

          <input
            type="number"
            placeholder="Treatment Cost"
            value={form.costOfTreatment}
            onChange={(e) =>
              setForm({
                ...form,
                costOfTreatment: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          />

          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
            className="border rounded-lg p-2"
          >
            {STATUS.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>

          <textarea
            placeholder="Remarks"
            value={form.remarks}
            onChange={(e) =>
              setForm({
                ...form,
                remarks: e.target.value,
              })
            }
            className="border rounded-lg p-2 md:col-span-3"
            rows={3}
          />
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
          >
            <Plus size={18} />

            {saving ? "Saving..." : editingId ? "Update Record" : "Save Record"}
          </button>
        </div>
      </form>

      {/* ================= RECORDS ================= */}

      {loading ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-gray-500">Loading bird health records...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <p className="text-gray-500">No bird health records found.</p>
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
                <tr key={record._id} className="border-t hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">
                    {new Date(record.date).toLocaleDateString()}
                  </td>

                  <td className="p-3">{record.pen}</td>

                  <td className="p-3">
                    <div className="font-medium">{record.healthIssue}</div>

                    <div className="text-xs text-gray-500">
                      {record.category}
                    </div>
                  </td>

                  <td className="p-3">{record.birdsAffected}</td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold
                          ${
                            record.severity === "Critical"
                              ? "bg-red-100 text-red-700"
                              : record.severity === "High"
                                ? "bg-orange-100 text-orange-700"
                                : record.severity === "Medium"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                          }`}
                    >
                      {record.severity}
                    </span>
                  </td>

                  <td className="p-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        STATUS_COLORS[record.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>

                  <td className="p-3">
                    {record.followUpStatus ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold
                            ${
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
                      {(role === "manager" || role === "superadmin") && (
                        <>
                          {!record.isDeleted && (
                            <button
                              onClick={() => editRecord(record)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                            >
                              Edit
                            </button>
                          )}

                          {!record.isDeleted && (
                            <button
                              onClick={() => removeRecord(record._id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}

                      {role === "superadmin" && record.isDeleted && (
                        <>
                          <div className="text-xs text-gray-500 text-left">
                            <p>
                              Deleted by{" "}
                              {record.deletedBy?.name ||
                                record.deletedByName ||
                                "Unknown"}
                            </p>
                            <p className="text-gray-400">
                              {record.deletedBy?.role ||
                                record.deletedByRole ||
                                ""}
                            </p>
                          </div>

                          <button
                            onClick={() => restoreRecord(record._id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                          >
                            Restore
                          </button>
                        </>
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
