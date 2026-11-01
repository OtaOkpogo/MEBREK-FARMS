import React, { useEffect, useMemo, useState, useCallback } from "react";
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

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100";

const labelClass = "mb-2 block text-sm font-semibold text-gray-700";

const panelClass = "rounded-xl border border-[#e5ebe3] bg-white shadow-sm";

const formatDate = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Format dates for date inputs using local calendar values.
// This avoids dates shifting by one day because of timezone conversion.
const formatDateForInput = (date) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatAge = (age) => {
  if (age === null || age === undefined || age === "") {
    return "—";
  }

  const numericAge = Number(age);

  if (!Number.isFinite(numericAge)) return "—";

  return `${numericAge} weeks`;
};

const getLifecycleClass = (status) => {
  switch (status) {
    case "Ready for Sale":
      return "bg-red-50 text-red-700 border-red-100";

    case "Approaching End of Lay":
      return "bg-amber-50 text-amber-700 border-amber-100";

    case "Growing / Not Yet Laying":
      return "bg-blue-50 text-blue-700 border-blue-100";

    case "Sold / Depopulated":
      return "bg-gray-100 text-gray-600 border-gray-200";

    default:
      return "bg-green-50 text-green-700 border-green-100";
  }
};

const getStatusClass = (status) => {
  if (status === "ACTIVE") {
    return "bg-green-50 text-green-700 border-green-100";
  }

  if (status === "SOLD") {
    return "bg-gray-100 text-gray-600 border-gray-200";
  }

  return "bg-amber-50 text-amber-700 border-amber-100";
};

const getErrorMessage = (error, fallback) => {
  return error?.response?.data?.message || error?.message || fallback;
};

// Supports the response formats commonly returned by the API client.
const extractFlocks = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.flocks)) return response.flocks;
  if (Array.isArray(response?.data?.flocks)) return response.data.flocks;
  if (Array.isArray(response?.data)) return response.data;

  return [];
};

export default function Flocks() {
  const [flocks, setFlocks] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // ============================================================
  // LOAD FLOCKS
  // ============================================================

  const loadFlocks = useCallback(async (showToast = false) => {
    try {
      setLoading(true);

      const response = await fetchFlocks();

      setFlocks(extractFlocks(response));

      if (showToast) {
        toast.success("Flock records refreshed.");
      }
    } catch (error) {
      console.error("LOAD FLOCKS ERROR:", error);

      toast.error(getErrorMessage(error, "Failed to load flock records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlocks();
  }, [loadFlocks]);

  // ============================================================
  // OCCUPIED PENS
  // ============================================================

  const occupiedPens = useMemo(() => {
    return new Set(
      flocks
        .filter((flock) => flock.status === "ACTIVE" && !flock.isDeleted)
        .map((flock) => flock.pen),
    );
  }, [flocks]);

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredFlocks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return flocks;

    return flocks.filter((flock) =>
      [
        flock.flockId,
        flock.pen,
        flock.status,
        flock.lifecycleStatus,
        flock.remarks,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [flocks, search]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const stats = useMemo(() => {
    const active = flocks.filter(
      (flock) => flock.status === "ACTIVE" && !flock.isDeleted,
    ).length;

    const sold = flocks.filter(
      (flock) => flock.status === "SOLD" && !flock.isDeleted,
    ).length;

    const deleted = flocks.filter((flock) => flock.isDeleted).length;

    return {
      active,
      sold,
      deleted,
      total: flocks.length,
    };
  }, [flocks]);

  // ============================================================
  // FORM HANDLERS
  // ============================================================

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
    if (!flock?._id) {
      toast.error("This flock record cannot be edited.");
      return;
    }

    setEditingId(flock._id);

    setFormData({
      flockId: flock.flockId || "",
      pen: flock.pen || "",
      placementDate: formatDateForInput(flock.placementDate),
      startingAgeWeeks: flock.startingAgeWeeks ?? "",
      remarks: flock.remarks || "",
    });

    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // SAVE FLOCK
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const flockId = formData.flockId.trim().toUpperCase();

    if (!flockId) {
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

    const placementDate = new Date(`${formData.placementDate}T00:00:00`);

    if (Number.isNaN(placementDate.getTime())) {
      toast.error("Please enter a valid placement date.");
      return;
    }

    const age = Number(formData.startingAgeWeeks);

    if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
      toast.error(
        `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks.`,
      );
      return;
    }

    // Check whether another active flock already occupies this pen.
    // The backend remains responsible for final validation.

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
      flockId,
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
        toast.error(getErrorMessage(error, "Failed to save flock."));
      }
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // SELL FLOCK
  // ============================================================

  const handleSell = async (flock) => {
    if (!flock?._id || actionBusyId) return;

    const confirmed = window.confirm(
      `Are you sure you want to mark flock "${flock.flockId}" as SOLD?`,
    );

    if (!confirmed) return;

    try {
      setActionBusyId(flock._id);

      await sellFlock(flock._id, new Date().toISOString());

      toast.success("Flock marked as sold.");

      await loadFlocks();
    } catch (error) {
      console.error("SELL FLOCK ERROR:", error);

      toast.error(getErrorMessage(error, "Failed to sell flock."));
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // DELETE FLOCK
  // ============================================================

  const handleDelete = async (flock) => {
    if (!flock?._id || actionBusyId) return;

    const confirmed = window.confirm(`Delete flock "${flock.flockId}"?`);

    if (!confirmed) return;

    try {
      setActionBusyId(flock._id);

      await deleteFlock(flock._id);

      toast.success("Flock deleted successfully.");

      await loadFlocks();
    } catch (error) {
      console.error("DELETE FLOCK ERROR:", error);

      toast.error(getErrorMessage(error, "Failed to delete flock."));
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // RESTORE FLOCK
  // ============================================================

  const handleRestore = async (flock) => {
    if (!flock?._id || actionBusyId) return;

    const confirmed = window.confirm(`Restore flock "${flock.flockId}"?`);

    if (!confirmed) return;

    try {
      setActionBusyId(flock._id);

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
        toast.error(getErrorMessage(error, "Failed to restore flock."));
      }
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f7f3] p-4 md:p-6">
      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 rounded-xl border border-[#e5ebe3] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-block rounded-full bg-[#eaf2e7] px-3 py-1 text-xs font-semibold tracking-wide text-[#315f3d]">
            FARM MANAGEMENT
          </span>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#263b2b] md:text-3xl">
            Flock Management
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            Manage poultry flocks, pen assignments, placement dates and flock
            lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadFlocks(true)}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
              }
            }}
            className="rounded-lg bg-[#39784b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d]"
          >
            {showForm ? "Close Form" : "+ Add New Flock"}
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e1eadf] bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Active Flocks</p>

            <span className="rounded-lg bg-[#eaf3e8] p-2 text-[#39784b]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3 4 7v5c0 5 3.5 8 8 9 4.5-1 8-4 8-9V7l-8-4Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m9 12 2 2 4-4"
                />
              </svg>
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#315f3d]">
            {stats.active}
          </p>

          <p className="mt-1 text-xs text-gray-400">Currently active flocks</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Sold Flocks</p>

            <span className="rounded-lg bg-gray-100 p-2 text-gray-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8h18l-2 12H5L3 8Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 8V5a4 4 0 0 1 8 0v3"
                />
              </svg>
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-gray-700">{stats.sold}</p>

          <p className="mt-1 text-xs text-gray-400">Completed or sold flocks</p>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Deleted Records</p>

            <span className="rounded-lg bg-red-50 p-2 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"
                />
              </svg>
            </span>
          </div>

          <p className="mt-3 text-3xl font-bold text-red-600">
            {stats.deleted}
          </p>

          <p className="mt-1 text-xs text-gray-400">
            Records available for restoration
          </p>
        </div>
      </div>

      {/* OCCUPIED PEN OVERVIEW */}

      <section className={`${panelClass} p-5`}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#2c4331]">Pen Occupancy</h2>

          <p className="mt-1 text-sm text-gray-500">
            See which pens currently have an active flock.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PENS.map((pen) => {
            const flock = flocks.find(
              (item) =>
                item.pen === pen && item.status === "ACTIVE" && !item.isDeleted,
            );

            const isOccupied = Boolean(flock);

            return (
              <div
                key={pen}
                className={`rounded-lg border p-3 ${
                  isOccupied
                    ? "border-[#dce9d9] bg-[#f4f8f1]"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-700">{pen}</p>

                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                      isOccupied
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {isOccupied ? "OCCUPIED" : "AVAILABLE"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  {isOccupied
                    ? `Active flock: ${flock?.flockId || "Assigned"}`
                    : "No active flock"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* FLOCK FORM */}

      {showForm && (
        <section className={`${panelClass} overflow-hidden`}>
          <div className="border-b border-[#e8ede6] bg-[#fbfcfa] p-5">
            <h2 className="text-lg font-bold text-[#2c4331]">
              {editingId ? "Edit Flock Details" : "Register New Flock"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Provide the flock identification, pen and placement information.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2"
          >
            <div>
              <label htmlFor="flockId" className={labelClass}>
                Flock ID
              </label>

              <input
                id="flockId"
                type="text"
                name="flockId"
                value={formData.flockId}
                onChange={handleChange}
                placeholder="e.g. FLOCK-001"
                required
                className={inputClass}
              />

              <p className="mt-1 text-xs text-gray-400">
                The flock ID will be saved in uppercase.
              </p>
            </div>

            <div>
              <label htmlFor="pen" className={labelClass}>
                Assign Pen
              </label>

              <select
                id="pen"
                name="pen"
                value={formData.pen}
                onChange={handleChange}
                required
                className={inputClass}
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

              <p className="mt-1 text-xs text-gray-400">
                Pens with active flocks cannot be selected.
              </p>
            </div>

            <div>
              <label htmlFor="placementDate" className={labelClass}>
                Placement Date
              </label>

              <input
                id="placementDate"
                type="date"
                name="placementDate"
                value={formData.placementDate}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="startingAgeWeeks" className={labelClass}>
                Starting Age (Weeks)
              </label>

              <input
                id="startingAgeWeeks"
                type="number"
                name="startingAgeWeeks"
                min="0"
                max={MAX_LAYING_AGE_WEEKS}
                step="1"
                value={formData.startingAgeWeeks}
                onChange={handleChange}
                placeholder="e.g. 18"
                required
                className={inputClass}
              />

              <p className="mt-1 text-xs text-gray-400">
                Enter the flock's age when it arrives at the farm. Maximum:{" "}
                {MAX_LAYING_AGE_WEEKS} weeks.
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="remarks" className={labelClass}>
                Remarks
              </label>

              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                placeholder="Optional remarks about this flock..."
                className={inputClass}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 md:col-span-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#39784b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Flock"
                    : "Create Flock"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* REGISTERED FLOCKS */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-[#e8ede6] bg-[#fbfcfa] p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#2c4331]">
              Registered Flocks
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Search and manage your farm's flock records.
            </p>
          </div>

          <div className="w-full md:max-w-sm">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search flock ID, pen or status..."
              className={inputClass}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#dce9d9] border-t-[#39784b]" />

            <p className="mt-3 text-sm text-gray-500">
              Loading flock records...
            </p>
          </div>
        ) : filteredFlocks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#edf4e9] text-[#39784b]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3c-4 0-7 3-7 7v4a7 7 0 0 0 14 0v-4c0-4-3-7-7-7Z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 11h.01M15 11h.01M9 16c1.5 1 4.5 1 6 0"
                />
              </svg>
            </div>

            <h3 className="mt-4 font-semibold text-gray-700">
              No flocks found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : "Register your first flock to get started."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-sm">
                <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                  <tr>
                    {[
                      "Flock ID",
                      "Pen",
                      "Placement Date",
                      "Current Age",
                      "Lifecycle",
                      "Remaining",
                      "Expected End of Lay",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="whitespace-nowrap px-4 py-4 font-semibold"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredFlocks.map((flock) => {
                    const busy = actionBusyId === flock._id;

                    return (
                      <tr
                        key={flock._id}
                        className={`transition hover:bg-[#f7faf5] ${
                          flock.isDeleted ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="font-bold text-gray-800">
                            {flock.flockId || "—"}
                          </div>

                          {flock.remarks && (
                            <p
                              className="mt-1 max-w-[180px] truncate text-xs text-gray-400"
                              title={flock.remarks}
                            >
                              {flock.remarks}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-700">
                          {flock.pen || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                          {formatDate(flock.placementDate)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-700">
                          {formatAge(flock.currentAgeWeeks)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getLifecycleClass(
                              flock.lifecycleStatus,
                            )}`}
                          >
                            {flock.lifecycleStatus || "—"}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                          {formatAge(flock.weeksRemaining)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                          {formatDate(flock.expectedEndOfLay)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-bold ${getStatusClass(
                              flock.status,
                            )}`}
                          >
                            {flock.status || "—"}
                          </span>

                          {flock.isDeleted && (
                            <span className="ml-2 inline-flex rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">
                              DELETED
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {!flock.isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(flock)}
                                  disabled={Boolean(actionBusyId)}
                                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                                >
                                  Edit
                                </button>

                                {flock.status === "ACTIVE" && (
                                  <button
                                    type="button"
                                    onClick={() => handleSell(flock)}
                                    disabled={Boolean(actionBusyId)}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                                  >
                                    {busy ? "Processing..." : "Sell"}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDelete(flock)}
                                  disabled={Boolean(actionBusyId)}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  {busy ? "Processing..." : "Delete"}
                                </button>
                              </>
                            )}

                            {flock.isDeleted && (
                              <button
                                type="button"
                                onClick={() => handleRestore(flock)}
                                disabled={Boolean(actionBusyId)}
                                className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                              >
                                {busy ? "Processing..." : "Restore"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-100 bg-[#fbfcfa] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-gray-500">
                Showing {filteredFlocks.length} of {flocks.length} flock records
              </p>

              <p className="text-xs text-gray-400">
                Active pens cannot be assigned to another active flock.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
