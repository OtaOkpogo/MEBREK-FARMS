import { useEffect, useState } from "react";
import {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  restoreMedication,
} from "../services/medicationService";
import { getCurrentUser } from "../services/authService";

export default function Medications() {
  const [medications, setMedications] = useState([]);

  const [formData, setFormData] = useState({
    medicationName: "",
    dosage: "",
    purpose: "",
    administeredTo: "",
  });

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUser();
    loadMedications();
  }, []);

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMedications = async () => {
    try {
      setLoading(true);
      // Backend returns deleted records inline for superadmin,
      // and only active records for everyone else.
      const data = await getMedications();
      setMedications(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load medication records");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.medicationName.trim()) return;

    try {
      setSubmitting(true);

      if (editingId) {
        await updateMedication(editingId, formData);
      } else {
        await createMedication(formData);
      }

      resetForm();
      loadMedications();
    } catch (err) {
      console.error(err);
      setError(
        editingId
          ? "Failed to update medication record"
          : "Failed to save medication record",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      medicationName: "",
      dosage: "",
      purpose: "",
      administeredTo: "",
    });
    setEditingId(null);
  };

  const handleEdit = (med) => {
    setEditingId(med._id);
    setFormData({
      medicationName: med.medicationName || "",
      dosage: med.dosage || "",
      purpose: med.purpose || "",
      administeredTo: med.administeredTo || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this medication record?")) return;

    try {
      await deleteMedication(id);
      // Superadmin keeps seeing the record (now marked deleted), so
      // refetch instead of removing it from state. Other roles never
      // requested a deleted record in the first place.
      loadMedications();
    } catch (err) {
      console.error(err);
      setError("Failed to delete medication record");
    }
  };

  const handleRestore = async (id) => {
    try {
      await restoreMedication(id);
      loadMedications();
    } catch (err) {
      console.error(err);
      setError("Failed to restore medication record");
    }
  };

  const isSuperadmin = user?.role === "superadmin";

  const filteredMedications = medications.filter((med) => {
    const term = search.toLowerCase();
    if (!term) return true;

    return (
      med.medicationName?.toLowerCase().includes(term) ||
      med.dosage?.toLowerCase().includes(term) ||
      med.purpose?.toLowerCase().includes(term) ||
      med.administeredTo?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <h1 className="text-4xl font-bold text-blue-700 mb-8">
        Bird Medications 💊
      </h1>

      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* FORM */}

      <div className="bg-white p-6 rounded-2xl shadow mb-10">
        <h2 className="text-2xl font-bold mb-6">
          {editingId ? "Edit Medication" : "Add Medication"}
        </h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Medication Name"
            value={formData.medicationName}
            onChange={(e) =>
              setFormData({
                ...formData,
                medicationName: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="text"
            placeholder="Dosage"
            value={formData.dosage}
            onChange={(e) =>
              setFormData({
                ...formData,
                dosage: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Purpose"
            value={formData.purpose}
            onChange={(e) =>
              setFormData({
                ...formData,
                purpose: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <input
            type="text"
            placeholder="Administered To"
            value={formData.administeredTo}
            onChange={(e) =>
              setFormData({
                ...formData,
                administeredTo: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <div className="md:col-span-2 flex gap-3">
            <button
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-3 px-6 transition"
            >
              {submitting
                ? "Saving..."
                : editingId
                  ? "Update Medication"
                  : "Save Medication"}
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold">Medication Records</h2>

          <input
            type="text"
            placeholder="Search by medication, dosage, purpose, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-3 rounded-lg md:w-80"
          />
        </div>

        {loading ? (
          <p>Loading medication records...</p>
        ) : filteredMedications.length === 0 ? (
          <p>
            {search
              ? "No medication records match your search"
              : "No medication records yet"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3">Medication</th>
                  <th>Dosage</th>
                  <th>Purpose</th>
                  <th>Administered To</th>
                  <th>Date</th>
                  {isSuperadmin && <th>Status</th>}
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filteredMedications.map((med) => (
                  <tr
                    key={med._id}
                    className={`border-b hover:bg-gray-50 ${
                      med.isDeleted ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="py-3">{med.medicationName}</td>
                    <td>{med.dosage}</td>
                    <td>{med.purpose}</td>
                    <td>{med.administeredTo}</td>
                    <td>
                      {med.dateAdministered
                        ? new Date(med.dateAdministered).toLocaleDateString()
                        : "—"}
                    </td>

                    {/* Only superadmin's payload ever includes deleted
                        records, so this column only makes sense for them */}
                    {isSuperadmin && (
                      <td>
                        {med.isDeleted ? (
                          <div className="text-xs">
                            <span className="inline-block bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-full mb-1">
                              Deleted
                            </span>
                            <div className="text-gray-500">
                              by{" "}
                              {med.deletedBy?.role
                                ? med.deletedBy.role.charAt(0).toUpperCase() +
                                  med.deletedBy.role.slice(1)
                                : "Unknown"}
                              {med.deletedAt &&
                                ` on ${new Date(
                                  med.deletedAt,
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

                    <td>
                      {med.isDeleted ? (
                        isSuperadmin && (
                          <button
                            onClick={() => handleRestore(med._id)}
                            className="text-green-600 hover:text-green-800 text-sm font-semibold"
                          >
                            Restore
                          </button>
                        )
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEdit(med)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(med._id)}
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
