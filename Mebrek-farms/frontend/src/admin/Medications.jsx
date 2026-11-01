import { useCallback, useEffect, useMemo, useState } from "react";
import { PENS } from "../constants/pens";

import {
  getMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  restoreMedication,
} from "../services/medicationService";

import { getCurrentUser } from "../services/authService";

const initialForm = {
  medicationName: "",
  dosage: "",
  purpose: "",
  administeredTo: "",
};

const getRecordsFromResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.medications)) return response.medications;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.medications)) {
    return response.data.medications;
  }

  return [];
};

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

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

export default function Medications() {
  const [medications, setMedications] = useState([]);

  const [formData, setFormData] = useState(initialForm);

  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================================================
  // USER AND PERMISSIONS
  // ============================================================

  const userRole = normalizeRole(user?.role);

  const isSuperadmin = userRole === "superadmin";

  const canEdit = userRole === "manager" || userRole === "superadmin";

  const canCreate = ["staff", "manager", "superadmin"].includes(userRole);

  // ============================================================
  // LOAD USER
  // ============================================================

  useEffect(() => {
    const loadUser = async () => {
      try {
        const data = await getCurrentUser();
        setUser(data?.admin || data?.user || data);
      } catch (err) {
        console.error("Unable to load current user:", err);
      }
    };

    loadUser();
  }, []);

  // ============================================================
  // LOAD MEDICATIONS
  // ============================================================

  const loadMedications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Backend controls which records are returned:
      // Superadmin receives deleted records inline.
      // Other roles receive active records only.
      const response = await getMedications();

      setMedications(getRecordsFromResponse(response));
    } catch (err) {
      console.error("Medication loading error:", err);

      setError(
        err?.response?.data?.message ||
          "Failed to load medication records. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedications();
  }, [loadMedications]);

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

  const resetForm = () => {
    setFormData(initialForm);
    setEditingId(null);
    setError("");
    setSuccess("");
  };

  // ============================================================
  // CREATE / UPDATE MEDICATION
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const medicationName = formData.medicationName.trim();

    if (!medicationName) {
      setError("Please enter the medication name.");
      return;
    }

    if (!formData.administeredTo) {
      setError("Please select the pen where the medication was administered.");
      return;
    }

    if (!canCreate) {
      setError("You do not have permission to create medication records.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        medicationName,
        dosage: formData.dosage.trim(),
        purpose: formData.purpose.trim(),
        administeredTo: formData.administeredTo,
      };

      if (editingId) {
        if (!canEdit) {
          setError("You do not have permission to edit medication records.");
          return;
        }

        await updateMedication(editingId, payload);

        setSuccess("Medication record updated successfully.");
      } else {
        await createMedication(payload);

        setSuccess("Medication record added successfully.");
      }

      setFormData(initialForm);
      setEditingId(null);

      await loadMedications();
    } catch (err) {
      console.error("Medication save error:", err);

      setError(
        err?.response?.data?.message ||
          (editingId
            ? "Failed to update medication record."
            : "Failed to save medication record."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // EDIT MEDICATION
  // ============================================================

  const handleEdit = (medication) => {
    if (!canEdit || medication.isDeleted) return;

    setEditingId(medication._id);

    setFormData({
      medicationName: medication.medicationName || "",
      dosage: medication.dosage || "",
      purpose: medication.purpose || "",
      administeredTo: medication.administeredTo || "",
    });

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // DELETE MEDICATION
  // ============================================================

  const handleDelete = async (id) => {
    if (!canEdit || !id || actionBusyId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this medication record?",
    );

    if (!confirmed) return;

    try {
      setActionBusyId(id);
      setError("");
      setSuccess("");

      await deleteMedication(id);

      if (editingId === id) {
        setFormData(initialForm);
        setEditingId(null);
      }

      setSuccess("Medication record deleted successfully.");

      // Superadmin still sees the deleted record.
      // The backend controls the returned records.
      await loadMedications();
    } catch (err) {
      console.error("Medication deletion error:", err);

      setError(
        err?.response?.data?.message || "Failed to delete medication record.",
      );
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // RESTORE MEDICATION
  // ============================================================

  const handleRestore = async (id) => {
    if (!isSuperadmin || !id || actionBusyId) return;

    const confirmed = window.confirm("Restore this medication record?");

    if (!confirmed) return;

    try {
      setActionBusyId(id);
      setError("");
      setSuccess("");

      await restoreMedication(id);

      setSuccess("Medication record restored successfully.");

      await loadMedications();
    } catch (err) {
      console.error("Medication restoration error:", err);

      setError(
        err?.response?.data?.message || "Failed to restore medication record.",
      );
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredMedications = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return medications;

    return medications.filter((med) => {
      return [
        med.medicationName,
        med.dosage,
        med.purpose,
        med.administeredTo,
        med.deletedBy?.role,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(term),
      );
    });
  }, [medications, search]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const statistics = useMemo(() => {
    const active = medications.filter((med) => !med.isDeleted);
    const deleted = medications.filter((med) => med.isDeleted);

    return {
      total: medications.length,
      active: active.length,
      deleted: deleted.length,
    };
  }, [medications]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f5f7f3] p-4 sm:p-6 lg:p-8">
      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#71856e]">
            Farm Management / Poultry Health
          </p>

          <h1 className="text-2xl font-bold text-[#304b37] sm:text-3xl">
            Bird Medications
          </h1>

          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Manage medication records and monitor treatments administered across
            farm pens.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMedications}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[#d8e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#426348] transition hover:bg-[#eef4ec] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span>
          Refresh Records
        </button>
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
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#dce5d9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">
              Total Medication Records
            </p>
            <span className="rounded-xl bg-[#edf3eb] p-2 text-lg">💊</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#426348]">
            {statistics.total.toLocaleString("en-NG")}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Records available to your account
          </p>
        </div>

        <div className="rounded-2xl border border-[#dce5d9] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Active Records</p>
            <span className="rounded-xl bg-green-50 p-2 text-lg">✓</span>
          </div>

          <p className="mt-3 text-3xl font-bold text-green-700">
            {statistics.active.toLocaleString("en-NG")}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            Current medication records
          </p>
        </div>

        {isSuperadmin && (
          <div className="rounded-2xl border border-[#eadada] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Deleted Records
              </p>
              <span className="rounded-xl bg-red-50 p-2 text-lg">🗑️</span>
            </div>

            <p className="mt-3 text-3xl font-bold text-[#b45353]">
              {statistics.deleted.toLocaleString("en-NG")}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Records available for restoration
            </p>
          </div>
        )}
      </div>

      {/* ADD / EDIT FORM */}
      {canCreate && (
        <div className="mb-8 rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#304b37]">
              {editingId ? "Edit Medication Record" : "Add Medication"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Record the medication and the pen where it was administered.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-5 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="medicationName"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Medication Name <span className="text-red-500">*</span>
              </label>

              <input
                id="medicationName"
                name="medicationName"
                type="text"
                placeholder="Enter medication name"
                value={formData.medicationName}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
                required
              />
            </div>

            <div>
              <label
                htmlFor="administeredTo"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Administered To (Pen) <span className="text-red-500">*</span>
              </label>

              <select
                id="administeredTo"
                name="administeredTo"
                value={formData.administeredTo}
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
                htmlFor="dosage"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Dosage
              </label>

              <input
                id="dosage"
                name="dosage"
                type="text"
                placeholder="e.g. 10ml per litre"
                value={formData.dosage}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              />
            </div>

            <div>
              <label
                htmlFor="purpose"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Purpose
              </label>

              <input
                id="purpose"
                name="purpose"
                type="text"
                placeholder="e.g. Treatment of respiratory infection"
                value={formData.purpose}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
              />
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#527b58] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#426748] disabled:cursor-not-allowed disabled:opacity-60"
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
                  disabled={submitting}
                  className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel Editing
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* MEDICATION RECORDS */}
      <div className="rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#304b37]">
              Medication Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View and manage medication treatments across the farm.
            </p>
          </div>

          <input
            type="search"
            placeholder="Search medication, dosage, purpose or pen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20 sm:max-w-sm"
          />
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Loading medication records...
          </div>
        ) : filteredMedications.length === 0 ? (
          <div className="rounded-xl bg-[#f7f9f5] px-4 py-12 text-center">
            <p className="font-semibold text-gray-600">
              {search
                ? "No medication records match your search."
                : "No medication records found."}
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Medication records will appear here when available.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead>
                <tr className="border-b border-[#e5eae2] bg-[#f7f9f5] text-xs uppercase tracking-wide text-gray-500">
                  <th className="rounded-l-lg px-4 py-4">Medication</th>
                  <th className="px-4 py-4">Dosage</th>
                  <th className="px-4 py-4">Purpose</th>
                  <th className="px-4 py-4">Pen</th>
                  <th className="px-4 py-4">Date</th>

                  {isSuperadmin && <th className="px-4 py-4">Status</th>}

                  <th className="rounded-r-lg px-4 py-4">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredMedications.map((med) => (
                  <tr
                    key={med._id}
                    className={`border-b border-gray-100 transition hover:bg-[#fafbf8] ${
                      med.isDeleted ? "bg-red-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-4 font-semibold text-gray-700">
                      {med.medicationName || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">
                      {med.dosage || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">
                      {med.purpose || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-gray-700">
                      {med.administeredTo || "—"}
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatDate(med.dateAdministered)}
                    </td>

                    {/* DELETED STATUS: SUPERADMIN ONLY */}
                    {isSuperadmin && (
                      <td className="px-4 py-4">
                        {med.isDeleted ? (
                          <div className="min-w-[130px]">
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              Deleted
                            </span>

                            <p className="mt-2 text-xs text-gray-500">
                              By{" "}
                              {med.deletedBy?.role
                                ? med.deletedBy.role.charAt(0).toUpperCase() +
                                  med.deletedBy.role.slice(1)
                                : "Unknown"}
                            </p>

                            {med.deletedAt && (
                              <p className="mt-1 text-xs text-gray-400">
                                {formatDate(med.deletedAt)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                    )}

                    {/* ACTIONS */}
                    <td className="px-4 py-4">
                      {med.isDeleted ? (
                        isSuperadmin && (
                          <button
                            type="button"
                            onClick={() => handleRestore(med._id)}
                            disabled={Boolean(actionBusyId)}
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionBusyId === med._id
                              ? "Restoring..."
                              : "Restore"}
                          </button>
                        )
                      ) : canEdit ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleEdit(med)}
                            disabled={Boolean(actionBusyId)}
                            className="text-sm font-semibold text-[#527b58] transition hover:text-[#304b37] disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(med._id)}
                            disabled={Boolean(actionBusyId)}
                            className="text-sm font-semibold text-red-600 transition hover:text-red-800 disabled:opacity-50"
                          >
                            {actionBusyId === med._id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && medications.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
            Showing {filteredMedications.length} of {medications.length}{" "}
            medication records.
          </div>
        )}
      </div>
    </div>
  );
}
