import { useEffect, useState } from "react";
import { fetchDashboardData } from "../services/dashboardService";
import {
  getBirdHealthRecords,
  createBirdHealthRecord,
  updateBirdHealthRecord,
  deleteBirdHealthRecord,
  restoreBirdHealthRecord,
} from "../services/birdHealthService";
import { getCurrentUser } from "../services/authService";

const SEVERITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS = ["Under Treatment", "Recovered", "Isolated", "Dead"];

const SEVERITY_COLORS = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  "Under Treatment": "bg-blue-100 text-blue-700",
  Recovered: "bg-green-100 text-green-700",
  Isolated: "bg-purple-100 text-purple-700",
  Dead: "bg-red-100 text-red-700",
};

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  penOrHouse: "",
  healthIssue: "",
  birdsAffected: "",
  symptoms: "",
  severity: "Low",
  vetConsulted: false,
  diagnosis: "",
  actionTaken: "",
  status: "Under Treatment",
  remarks: "",
};

export default function BirdHealth() {
  const [health, setHealth] = useState({
    healthyBirds: 0,
    sickBirds: 0,
    vaccinatedBirds: 0,
    mortalityRate: 0,
  });

  const [records, setRecords] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUser();
    loadHealthSummary();
    loadRecords();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHealthSummary = async () => {
    try {
      const data = await fetchDashboardData();

      const totalMortality =
        data?.mortality?.reduce(
          (sum, item) => sum + (item.numberDead || 0),
          0,
        ) || 0;

      // Sum birds actually vaccinated (quantity per record), not just
      // how many vaccination records exist — one record can cover many birds.
      const vaccinated =
        data?.vaccinations?.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ) || 0;

      setHealth({
        healthyBirds: 5000 - totalMortality,
        sickBirds: totalMortality,
        vaccinatedBirds: vaccinated,
        mortalityRate: ((totalMortality / 5000) * 100).toFixed(2),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);
      const data = await getBirdHealthRecords();
      setRecords(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load bird health records");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.penOrHouse.trim() || !formData.healthIssue.trim()) return;

    try {
      setSubmitting(true);

      if (editingId) {
        await updateBirdHealthRecord(editingId, formData);
      } else {
        await createBirdHealthRecord(formData);
      }

      resetForm();
      loadRecords();
    } catch (err) {
      console.error(err);
      setError("Failed to save bird health record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record._id);
    setFormData({
      date: record.date
        ? new Date(record.date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      penOrHouse: record.penOrHouse || "",
      healthIssue: record.healthIssue || "",
      birdsAffected: record.birdsAffected ?? "",
      symptoms: record.symptoms || "",
      severity: record.severity || "Low",
      vetConsulted: !!record.vetConsulted,
      diagnosis: record.diagnosis || "",
      actionTaken: record.actionTaken || "",
      status: record.status || "Under Treatment",
      remarks: record.remarks || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this bird health record?")) return;

    try {
      await deleteBirdHealthRecord(id);
      loadRecords();
    } catch (err) {
      console.error(err);
      setError("Failed to delete bird health record");
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreBirdHealthRecord(id);
      loadRecords();
    } catch (err) {
      console.error(err);
      setError("Failed to restore bird health record");
    }
  };

  const isSuperadmin = user?.role === "superadmin";

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold text-green-700 mb-8">
        Bird Health Dashboard 🐓
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* SUMMARY KPI CARDS */}

      <div className="grid md:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">Healthy Birds</h2>
          <p className="text-4xl font-bold text-green-600 mt-2">
            {health.healthyBirds}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">Sick/Dead Birds</h2>
          <p className="text-4xl font-bold text-red-600 mt-2">
            {health.sickBirds}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">Vaccinated Birds</h2>
          <p className="text-4xl font-bold text-blue-600 mt-2">
            {health.vaccinatedBirds}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-gray-500">Mortality Rate</h2>
          <p className="text-4xl font-bold text-orange-500 mt-2">
            {health.mortalityRate}%
          </p>
        </div>
      </div>

      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">
        <h2 className="text-2xl font-bold mb-6">
          {editingId ? "Edit Health Record" : "Log Health Issue"}
        </h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Pen / House
            </label>
            <input
              type="text"
              placeholder="e.g. Battery Cage Row 2"
              value={formData.penOrHouse}
              onChange={(e) =>
                setFormData({ ...formData, penOrHouse: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Health Issue / Disease
            </label>
            <input
              type="text"
              placeholder="e.g. Coccidiosis"
              value={formData.healthIssue}
              onChange={(e) =>
                setFormData({ ...formData, healthIssue: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">
              Number of Birds Affected
            </label>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={formData.birdsAffected}
              onChange={(e) =>
                setFormData({ ...formData, birdsAffected: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-500 mb-1">
              Symptoms Observed
            </label>
            <input
              type="text"
              placeholder="e.g. Bloody droppings"
              value={formData.symptoms}
              onChange={(e) =>
                setFormData({ ...formData, symptoms: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Severity</label>
            <select
              value={formData.severity}
              onChange={(e) =>
                setFormData({ ...formData, severity: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-500 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 border p-3 rounded-lg w-full cursor-pointer">
              <input
                type="checkbox"
                checked={formData.vetConsulted}
                onChange={(e) =>
                  setFormData({ ...formData, vetConsulted: e.target.checked })
                }
              />
              <span className="text-sm text-gray-700">
                Veterinarian Consulted
              </span>
            </label>
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm text-gray-500 mb-1">
              Diagnosis
            </label>
            <input
              type="text"
              value={formData.diagnosis}
              onChange={(e) =>
                setFormData({ ...formData, diagnosis: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm text-gray-500 mb-1">
              Action Taken
            </label>
            <input
              type="text"
              value={formData.actionTaken}
              onChange={(e) =>
                setFormData({ ...formData, actionTaken: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm text-gray-500 mb-1">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) =>
                setFormData({ ...formData, remarks: e.target.value })
              }
              className="border p-3 rounded-lg w-full"
              rows={2}
            />
          </div>

          <div className="md:col-span-3 flex gap-3">
            <button
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg py-3 px-6 transition"
            >
              {submitting
                ? "Saving..."
                : editingId
                  ? "Update Record"
                  : "Save Health Record"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg py-3 px-6 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* TABLE */}

      <div className="bg-white p-6 rounded-2xl shadow">
        <h2 className="text-2xl font-bold mb-6">Bird Health Records</h2>

        {loading ? (
          <p>Loading health records...</p>
        ) : records.length === 0 ? (
          <p>No health records yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 pr-4">Date</th>
                  <th className="pr-4">Pen/House</th>
                  <th className="pr-4">Health Issue</th>
                  <th className="pr-4">Affected</th>
                  <th className="pr-4">Symptoms</th>
                  <th className="pr-4">Severity</th>
                  <th className="pr-4">Vet</th>
                  <th className="pr-4">Diagnosis</th>
                  <th className="pr-4">Action Taken</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Remarks</th>
                  <th className="pr-4">Recorded By</th>
                  {isSuperadmin && <th className="pr-4">Record Status</th>}
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {records.map((rec) => (
                  <tr
                    key={rec._id}
                    className={`border-b hover:bg-gray-50 align-top ${
                      rec.isDeleted ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {rec.date ? new Date(rec.date).toLocaleDateString() : "—"}
                    </td>
                    <td className="pr-4">{rec.penOrHouse}</td>
                    <td className="pr-4">{rec.healthIssue}</td>
                    <td className="pr-4">{rec.birdsAffected}</td>
                    <td className="pr-4">{rec.symptoms}</td>
                    <td className="pr-4">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          SEVERITY_COLORS[rec.severity] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {rec.severity}
                      </span>
                    </td>
                    <td className="pr-4">{rec.vetConsulted ? "Yes" : "No"}</td>
                    <td className="pr-4">{rec.diagnosis}</td>
                    <td className="pr-4">{rec.actionTaken}</td>
                    <td className="pr-4">
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                          STATUS_COLORS[rec.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="pr-4">{rec.remarks}</td>
                    <td className="pr-4 capitalize">
                      {rec.recordedBy?.role || "—"}
                    </td>

                    {isSuperadmin && (
                      <td className="pr-4">
                        {rec.isDeleted ? (
                          <div className="text-xs">
                            <span className="inline-block bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full mb-1">
                              Deleted
                            </span>
                            <div className="text-gray-500 capitalize">
                              by {rec.deletedBy?.role || "Unknown"}
                              {rec.deletedAt &&
                                ` on ${new Date(
                                  rec.deletedAt,
                                ).toLocaleDateString()}`}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-block bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full text-xs">
                            Active
                          </span>
                        )}
                      </td>
                    )}

                    <td className="whitespace-nowrap">
                      {rec.isDeleted ? (
                        isSuperadmin && (
                          <button
                            onClick={() => handleRestore(rec._id)}
                            className="text-green-600 hover:text-green-800 text-sm font-semibold"
                          >
                            Restore
                          </button>
                        )
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEdit(rec)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(rec._id)}
                            className="text-red-600 hover:text-red-800 text-sm font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
