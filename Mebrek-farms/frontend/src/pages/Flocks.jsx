import React, { useEffect, useMemo, useState } from "react";

import {
  fetchFlocks,
  createFlock,
  updateFlock,
  sellFlock,
  deleteFlock,
  restoreFlock,
} from "../services/flockService";

import { toast } from "react-toastify";

const MAX_LAYING_AGE_WEEKS = 104;

const PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Deep Litter Pen 4",
  "Deep Litter Pen 5",
  "Sick Bay",
  "Pen 150",
  "Brooding House",
];

const EMPTY_FORM = {
  flockId: "",
  pen: "",
  placementDate: "",
  startingAgeWeeks: "",
  remarks: "",
};

const formatDate = (date) => {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString();
};

const formatAge = (age) => {
  if (age === null || age === undefined || Number.isNaN(Number(age))) {
    return "—";
  }

  return `${age} weeks`;
};

const getLifecycleClass = (status) => {
  if (status === "Ready for Sale") {
    return "bg-red-100 text-red-700";
  }

  if (status === "Approaching End of Lay") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "Growing / Not Yet Laying") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "Sold / Depopulated") {
    return "bg-gray-100 text-gray-700";
  }

  return "bg-green-100 text-green-700";
};

export default function Flocks() {
  const [flocks, setFlocks] = useState([]);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);

  /*
  |--------------------------------------------------------------------------
  | LOAD FLOCKS
  |--------------------------------------------------------------------------
  */

  const loadFlocks = async () => {
    try {
      setLoading(true);

      const response = await fetchFlocks();

      setFlocks(Array.isArray(response?.flocks) ? response.flocks : []);
    } catch (error) {
      console.error("LOAD FLOCKS ERROR:", error);

      toast.error(error.response?.data?.message || "Failed to load flocks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlocks();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | OCCUPIED PENS
  |--------------------------------------------------------------------------
  */

  const occupiedPens = useMemo(() => {
    return new Set(
      flocks
        .filter((flock) => flock.status === "ACTIVE" && !flock.isDeleted)
        .map((flock) => flock.pen),
    );
  }, [flocks]);

  /*
  |--------------------------------------------------------------------------
  | SEARCH
  |--------------------------------------------------------------------------
  */

  const filteredFlocks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return flocks;
    }

    return flocks.filter((flock) =>
      [flock.flockId, flock.pen, flock.status, flock.lifecycleStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [flocks, search]);

  /*
  |--------------------------------------------------------------------------
  | STATS
  |--------------------------------------------------------------------------
  */

  const stats = useMemo(() => {
    return {
      active: flocks.filter(
        (flock) => flock.status === "ACTIVE" && !flock.isDeleted,
      ).length,

      sold: flocks.filter(
        (flock) => flock.status === "SOLD" && !flock.isDeleted,
      ).length,

      deleted: flocks.filter((flock) => flock.isDeleted).length,
    };
  }, [flocks]);

  /*
  |--------------------------------------------------------------------------
  | FORM HANDLERS
  |--------------------------------------------------------------------------
  */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (flock) => {
    setEditingId(flock._id);

    setFormData({
      flockId: flock.flockId || "",
      pen: flock.pen || "",
      placementDate: flock.placementDate
        ? new Date(flock.placementDate).toISOString().split("T")[0]
        : "",
      startingAgeWeeks: flock.startingAgeWeeks ?? "",
      remarks: flock.remarks || "",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /*
  |--------------------------------------------------------------------------
  | SAVE FLOCK
  |--------------------------------------------------------------------------
  */

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.flockId.trim()) {
      toast.error("Flock ID is required.");
      return;
    }

    if (!formData.pen) {
      toast.error("Please select a pen.");
      return;
    }

    if (!formData.placementDate) {
      toast.error("Placement date is required.");
      return;
    }

    const age = Number(formData.startingAgeWeeks);

    if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
      toast.error(
        `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks.`,
      );
      return;
    }

    /*
    |--------------------------------------------------------------------------
    | FRONTEND PEN OCCUPANCY CHECK
    |--------------------------------------------------------------------------
    */

    if (!editingId) {
      const existingActiveFlock = flocks.find(
        (flock) =>
          flock.pen === formData.pen &&
          flock.status === "ACTIVE" &&
          !flock.isDeleted,
      );

      if (existingActiveFlock) {
        toast.error(
          `Pen "${formData.pen}" already has active flock "${existingActiveFlock.flockId}".`,
        );

        return;
      }
    }

    const payload = {
      flockId: formData.flockId.trim().toUpperCase(),

      pen: formData.pen,

      placementDate: formData.placementDate,

      startingAgeWeeks: age,

      remarks: formData.remarks.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateFlock(editingId, payload);

        toast.success("Flock updated successfully.");
      } else {
        await createFlock(payload);

        toast.success("Flock created successfully.");
      }

      resetForm();

      await loadFlocks();
    } catch (error) {
      console.error("SAVE FLOCK ERROR:", error);

      console.error("STATUS:", error.response?.status);

      console.error("RESPONSE:", error.response?.data);

      const responseData = error.response?.data;

      if (error.response?.status === 409 && responseData?.existingFlock) {
        const existing = responseData.existingFlock;

        toast.error(
          `Pen "${existing.pen}" already has active flock "${existing.flockId}".`,
        );
      } else {
        toast.error(responseData?.message || "Failed to save flock.");
      }
    } finally {
      setSaving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SELL
  |--------------------------------------------------------------------------
  */

  const handleSell = async (flock) => {
    const confirmed = window.confirm(
      `Are you sure you want to mark flock "${flock.flockId}" as SOLD?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await sellFlock(flock._id, new Date().toISOString());

      toast.success("Flock marked as sold.");

      await loadFlocks();
    } catch (error) {
      console.error("SELL FLOCK ERROR:", error);

      toast.error(error.response?.data?.message || "Failed to sell flock.");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (flock) => {
    const confirmed = window.confirm(`Delete flock "${flock.flockId}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteFlock(flock._id);

      toast.success("Flock deleted successfully.");

      await loadFlocks();
    } catch (error) {
      console.error("DELETE FLOCK ERROR:", error);

      toast.error(error.response?.data?.message || "Failed to delete flock.");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | RESTORE
  |--------------------------------------------------------------------------
  */

  const handleRestore = async (flock) => {
    const confirmed = window.confirm(`Restore flock "${flock.flockId}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await restoreFlock(flock._id);

      toast.success("Flock restored successfully.");

      await loadFlocks();
    } catch (error) {
      console.error("RESTORE FLOCK ERROR:", error);

      const existing = error.response?.data?.existingFlock;

      if (existing) {
        toast.error(
          `Cannot restore. Pen "${existing.pen}" is occupied by "${existing.flockId}".`,
        );
      } else {
        toast.error(
          error.response?.data?.message || "Failed to restore flock.",
        );
      }
    }
  };

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Flocks</h1>

          <p className="text-gray-500 mt-1">
            Manage poultry flocks, pens, placement and lifecycle.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
            }
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-semibold transition"
        >
          {showForm ? "Cancel" : "+ Add Flock"}
        </button>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-500">
          <p className="text-sm text-gray-500">Active Flocks</p>

          <p className="text-3xl font-bold text-green-600 mt-1">
            {stats.active}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-gray-400">
          <p className="text-sm text-gray-500">Sold Flocks</p>

          <p className="text-3xl font-bold text-gray-600 mt-1">{stats.sold}</p>
        </div>

        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-red-400">
          <p className="text-sm text-gray-500">Deleted Records</p>

          <p className="text-3xl font-bold text-red-600 mt-1">
            {stats.deleted}
          </p>
        </div>
      </div>

      {/* FORM */}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-5">
            {editingId ? "Edit Flock" : "Register New Flock"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {/* FLOCK ID */}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Flock ID
              </label>

              <input
                type="text"
                name="flockId"
                value={formData.flockId}
                onChange={handleChange}
                placeholder="e.g. FLOCK-001"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* PEN */}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pen
              </label>

              <select
                name="pen"
                value={formData.pen}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select Pen</option>

                {PENS.map((pen) => {
                  const occupied =
                    occupiedPens.has(pen) &&
                    !(editingId && formData.pen === pen);

                  return (
                    <option key={pen} value={pen} disabled={occupied}>
                      {occupied ? `${pen} — OCCUPIED` : pen}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* PLACEMENT DATE */}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Placement Date
              </label>

              <input
                type="date"
                name="placementDate"
                value={formData.placementDate}
                onChange={handleChange}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* STARTING AGE */}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Starting Age (Weeks)
              </label>

              <input
                type="number"
                name="startingAgeWeeks"
                min="0"
                max={MAX_LAYING_AGE_WEEKS}
                value={formData.startingAgeWeeks}
                onChange={handleChange}
                placeholder="e.g. 18"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              <p className="text-xs text-gray-500 mt-1">
                Maximum: {MAX_LAYING_AGE_WEEKS} weeks
              </p>
            </div>

            {/* REMARKS */}

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Remarks
              </label>

              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows="3"
                placeholder="Optional remarks..."
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* BUTTONS */}

            <div className="md:col-span-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-lg border hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Flock"
                    : "Create Flock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEARCH */}

      <div className="bg-white rounded-xl shadow p-4">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by flock ID, pen, status or lifecycle..."
          className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* TABLE */}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">
            Loading flocks...
          </div>
        ) : filteredFlocks.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No flocks found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3">Flock ID</th>

                  <th className="text-left px-4 py-3">Pen</th>

                  <th className="text-left px-4 py-3">Placement</th>

                  <th className="text-left px-4 py-3">Age</th>

                  <th className="text-left px-4 py-3">Lifecycle</th>

                  <th className="text-left px-4 py-3">Remaining</th>

                  <th className="text-left px-4 py-3">End of Lay</th>

                  <th className="text-left px-4 py-3">Status</th>

                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredFlocks.map((flock) => (
                  <tr key={flock._id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-semibold">{flock.flockId}</td>

                    <td className="px-4 py-4">{flock.pen}</td>

                    <td className="px-4 py-4">
                      {formatDate(flock.placementDate)}
                    </td>

                    <td className="px-4 py-4">
                      {formatAge(flock.currentAgeWeeks)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getLifecycleClass(
                          flock.lifecycleStatus,
                        )}`}
                      >
                        {flock.lifecycleStatus}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {formatAge(flock.weeksRemaining)}
                    </td>

                    <td className="px-4 py-4">
                      {formatDate(flock.expectedEndOfLay)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          flock.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {flock.status}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!flock.isDeleted && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEdit(flock)}
                              className="px-3 py-1.5 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200"
                            >
                              Edit
                            </button>

                            {flock.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => handleSell(flock)}
                                className="px-3 py-1.5 rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200"
                              >
                                Sell
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(flock)}
                              className="px-3 py-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </>
                        )}

                        {flock.isDeleted && (
                          <button
                            type="button"
                            onClick={() => handleRestore(flock)}
                            className="px-3 py-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200"
                          >
                            Restore
                          </button>
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
    </div>
  );
}
