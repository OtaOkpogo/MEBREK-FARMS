import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  fetchFlocks,
  fetchFlock,
  fetchFlockAllocations,
  fetchFlockTransfers,
  fetchFlockPopulationHistory,
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

const formatDateTime = (date) => {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  if (age === null || age === undefined || age === "") return "—";

  const numericAge = Number(age);
  return Number.isFinite(numericAge) ? `${numericAge} weeks` : "—";
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") return "—";

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString("en-NG") : "—";
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

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const extractFlocks = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.flocks)) return response.flocks;
  if (Array.isArray(response?.data?.flocks)) return response.data.flocks;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const extractArray = (response, keys = []) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data?.[key])) return response.data[key];
  }

  return [];
};

const extractFlockRecord = (response) =>
  response?.flock || response?.data?.flock || response?.data || response;

const getPopulationSummary = (allocations = []) => {
  const active = allocations.filter(
    (allocation) => allocation.status === "ACTIVE",
  );

  if (!active.length) {
    return {
      known: true,
      total: 0,
      activeCount: 0,
    };
  }

  const allKnown = active.every(
    (allocation) =>
      allocation.currentBirds !== null &&
      allocation.currentBirds !== undefined &&
      allocation.currentBirds !== "",
  );

  if (!allKnown) {
    return {
      known: false,
      total: null,
      activeCount: active.length,
    };
  }

  return {
    known: true,
    total: active.reduce(
      (total, allocation) => total + Number(allocation.currentBirds),
      0,
    ),
    activeCount: active.length,
  };
};

function DetailSection({ title, subtitle, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <h3 className="font-bold text-gray-800">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailValue({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-gray-800">
        {value ?? "—"}
      </p>
    </div>
  );
}

function EmptyMessage({ children }) {
  return (
    <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
      {children}
    </p>
  );
}

function FlockDetailsModal({
  flock,
  allocations,
  transfers,
  history,
  loading,
  error,
  onClose,
}) {
  const population = useMemo(
    () => getPopulationSummary(allocations),
    [allocations],
  );

  if (!flock) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/60 p-3 py-6 md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-auto w-full max-w-6xl overflow-hidden rounded-2xl bg-[#f5f7f3] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-green-900/10 bg-white px-5 py-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-green-700">
              Flock record
            </span>
            <h2 className="mt-1 text-xl font-bold text-[#263b2b] md:text-2xl">
              {flock.flockId || "Flock Details"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed flock information, allocations and population records
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-600 transition hover:bg-red-50 hover:text-red-600"
            aria-label="Close flock details"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-4 md:p-6">
          {loading ? (
            <div className="rounded-xl bg-white p-12 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
              <p className="mt-3 text-sm text-gray-500">
                Loading flock details and history...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-green-100 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Current Population
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-800">
                    {population.known
                      ? formatNumber(population.total)
                      : "Unknown"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {population.known
                      ? "Based on active allocations"
                      : "Population has not been confirmed"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Active Allocations
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-800">
                    {population.activeCount}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Current pen assignments
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Transfers Recorded
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-800">
                    {transfers.length}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Transfer records</p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Population Events
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-800">
                    {history.length}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Recorded population history
                  </p>
                </div>
              </div>

              <DetailSection title="Flock Information">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailValue label="Flock ID" value={flock.flockId} />
                  <DetailValue label="Legacy Pen" value={flock.pen} />
                  <DetailValue label="Status" value={flock.status} />
                  <DetailValue
                    label="Placement Date"
                    value={formatDate(flock.placementDate)}
                  />
                  <DetailValue
                    label="Starting Age"
                    value={formatAge(flock.startingAgeWeeks)}
                  />
                  <DetailValue
                    label="Current Age"
                    value={formatAge(flock.currentAgeWeeks)}
                  />
                  <DetailValue
                    label="Weeks Remaining"
                    value={formatAge(flock.weeksRemaining)}
                  />
                  <DetailValue
                    label="Expected End of Lay"
                    value={formatDate(flock.expectedEndOfLay)}
                  />
                  <DetailValue
                    label="Lifecycle Status"
                    value={flock.lifecycleStatus}
                  />
                  <DetailValue
                    label="Initial Bird Count"
                    value={
                      flock.initialBirdCount === null ||
                      flock.initialBirdCount === undefined
                        ? "Not recorded"
                        : formatNumber(flock.initialBirdCount)
                    }
                  />
                  <DetailValue
                    label="Population Tracking"
                    value={flock.populationTrackingStatus || "—"}
                  />
                  <DetailValue
                    label="Sale Date"
                    value={formatDate(flock.saleDate)}
                  />
                </div>

                {flock.remarks && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Remarks</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                      {flock.remarks}
                    </p>
                  </div>
                )}
              </DetailSection>

              <DetailSection
                title="Pen Allocations"
                subtitle="Both current and closed allocations are shown here."
              >
                {allocations.length === 0 ? (
                  <EmptyMessage>No allocation records found.</EmptyMessage>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                        <tr>
                          {[
                            "Pen",
                            "Opening Birds",
                            "Current Birds",
                            "Allocation Date",
                            "Status",
                            "Closed Date",
                            "Close Reason",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="px-3 py-3 font-semibold"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allocations.map((allocation) => (
                          <tr key={allocation._id}>
                            <td className="px-3 py-3 font-semibold text-gray-800">
                              {allocation.pen || "—"}
                            </td>
                            <td className="px-3 py-3">
                              {formatNumber(allocation.openingBirds)}
                            </td>
                            <td className="px-3 py-3 font-semibold">
                              {formatNumber(allocation.currentBirds)}
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(allocation.allocationDate)}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${
                                  allocation.status === "ACTIVE"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {allocation.status || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {formatDate(allocation.closedAt)}
                            </td>
                            <td className="px-3 py-3">
                              {allocation.closedReason || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DetailSection>

              <DetailSection
                title="Transfer History"
                subtitle="Movement of this flock between farm pens."
              >
                {transfers.length === 0 ? (
                  <EmptyMessage>No transfer records found.</EmptyMessage>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                        <tr>
                          {[
                            "Transfer Date",
                            "From Pen",
                            "To Pen",
                            "Birds Moved",
                            "Reason",
                            "Status",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="px-3 py-3 font-semibold"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transfers.map((transfer) => (
                          <tr key={transfer._id}>
                            <td className="px-3 py-3">
                              {formatDate(transfer.transferDate)}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {transfer.fromPen || "—"}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {transfer.toPen || "—"}
                            </td>
                            <td className="px-3 py-3 font-bold">
                              {formatNumber(transfer.birdsMoved)}
                            </td>
                            <td className="px-3 py-3">
                              {transfer.reason || transfer.remarks || "—"}
                            </td>
                            <td className="px-3 py-3">
                              {transfer.status || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DetailSection>

              <DetailSection
                title="Population History"
                subtitle="Initial placement, transfers, mortality, sales and adjustments."
              >
                {history.length === 0 ? (
                  <EmptyMessage>
                    No population history records found.
                  </EmptyMessage>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                        <tr>
                          {[
                            "Date",
                            "Event",
                            "Pen",
                            "Quantity Change",
                            "Balance After",
                            "Remarks",
                          ].map((heading) => (
                            <th
                              key={heading}
                              className="px-3 py-3 font-semibold"
                            >
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {history.map((item) => (
                          <tr key={item._id}>
                            <td className="whitespace-nowrap px-3 py-3">
                              {formatDateTime(item.eventDate)}
                            </td>
                            <td className="px-3 py-3 font-semibold">
                              {item.eventType || "—"}
                            </td>
                            <td className="px-3 py-3">{item.pen || "—"}</td>
                            <td className="px-3 py-3 font-semibold">
                              {item.quantityChange === null ||
                              item.quantityChange === undefined
                                ? "Unknown"
                                : `${item.quantityChange > 0 ? "+" : ""}${formatNumber(item.quantityChange)}`}
                            </td>
                            <td className="px-3 py-3">
                              {formatNumber(item.balanceAfter)}
                            </td>
                            <td className="px-3 py-3">{item.remarks || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DetailSection>
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#39784b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d]"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Flocks() {
  const [flocks, setFlocks] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [selectedFlock, setSelectedFlock] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [populationHistory, setPopulationHistory] = useState([]);

  const loadFlocks = useCallback(async (showToast = false) => {
    try {
      setLoading(true);
      const response = await fetchFlocks();
      setFlocks(extractFlocks(response));

      if (showToast) toast.success("Flock records refreshed.");
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

  const occupiedPens = useMemo(() => {
    return new Set(
      flocks
        .filter((flock) => flock.status === "ACTIVE" && !flock.isDeleted)
        .map((flock) => flock.pen),
    );
  }, [flocks]);

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

  const stats = useMemo(() => {
    const active = flocks.filter(
      (flock) => flock.status === "ACTIVE" && !flock.isDeleted,
    ).length;

    const sold = flocks.filter(
      (flock) => flock.status === "SOLD" && !flock.isDeleted,
    ).length;

    const deleted = flocks.filter((flock) => flock.isDeleted).length;

    return { active, sold, deleted, total: flocks.length };
  }, [flocks]);

  // ============================================================
  // VIEW FLOCK DETAILS
  // ============================================================

  const handleViewDetails = async (flock) => {
    if (!flock?._id) {
      toast.error("Unable to identify this flock record.");
      return;
    }

    setSelectedFlock(flock);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError("");

    setAllocations([]);
    setTransfers([]);
    setPopulationHistory([]);

    try {
      const [
        flockResponse,
        allocationResponse,
        transferResponse,
        historyResponse,
      ] = await Promise.all([
        fetchFlock(flock._id),
        fetchFlockAllocations(flock._id),
        fetchFlockTransfers(flock._id),
        fetchFlockPopulationHistory(flock._id),
      ]);

      setSelectedFlock(extractFlockRecord(flockResponse));

      setAllocations(extractArray(allocationResponse, ["allocations"]));

      setTransfers(extractArray(transferResponse, ["transfers"]));

      setPopulationHistory(
        extractArray(historyResponse, [
          "history",
          "populationHistory",
          "records",
        ]),
      );
    } catch (error) {
      console.error("LOAD FLOCK DETAILS ERROR:", error);
      setDetailsError(
        getErrorMessage(error, "Unable to load complete flock details."),
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedFlock(null);
    setDetailsError("");
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
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

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ============================================================
  // SAVE FLOCK
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    const flockId = formData.flockId.trim().toUpperCase();

    if (!flockId) return toast.error("Flock ID is required.");
    if (!formData.pen) return toast.error("Please select a pen.");
    if (!formData.placementDate)
      return toast.error("Placement date is required.");

    const placementDate = new Date(`${formData.placementDate}T00:00:00`);

    if (Number.isNaN(placementDate.getTime())) {
      return toast.error("Please enter a valid placement date.");
    }

    const age = Number(formData.startingAgeWeeks);

    if (!Number.isInteger(age) || age < 0 || age > MAX_LAYING_AGE_WEEKS) {
      return toast.error(
        `Starting age must be a whole number between 0 and ${MAX_LAYING_AGE_WEEKS} weeks.`,
      );
    }

    if (!editingId) {
      const existingActiveFlock = flocks.find(
        (flock) =>
          flock.pen === formData.pen &&
          flock.status === "ACTIVE" &&
          !flock.isDeleted,
      );

      if (existingActiveFlock) {
        return toast.error(
          `Pen "${formData.pen}" already has active flock "${existingActiveFlock.flockId}".`,
        );
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

    try {
      setActionBusyId(flock._id);

      const allocationResponse = await fetchFlockAllocations(flock._id);
      const flockAllocations = extractArray(allocationResponse, [
        "allocations",
      ]);

      const activeAllocations = flockAllocations.filter(
        (allocation) => allocation.status === "ACTIVE",
      );

      if (!activeAllocations.length) {
        toast.error("This flock has no active allocations to sell.");
        return;
      }

      const unknown = activeAllocations.some(
        (allocation) =>
          allocation.currentBirds === null ||
          allocation.currentBirds === undefined,
      );

      if (unknown) {
        toast.error(
          "The population of one or more active allocations is unknown. Confirm the population before recording a sale.",
        );
        return;
      }

      const allocationSales = [];

      for (const allocation of activeAllocations) {
        const available = Number(allocation.currentBirds);

        if (available <= 0) continue;

        const entered = window.prompt(
          `Flock: ${flock.flockId}\nPen: ${allocation.pen}\nAvailable birds: ${available}\n\nEnter the number of birds sold from this pen. Enter 0 if none were sold.`,
          "0",
        );

        if (entered === null) return;

        if (entered.trim() === "" || !/^\d+$/.test(entered.trim())) {
          toast.error("Enter a valid whole number for birds sold.");
          return;
        }

        const birdsSold = Number(entered);

        if (birdsSold > available) {
          toast.error(
            `You cannot sell ${birdsSold} birds from ${allocation.pen}; only ${available} are recorded.`,
          );
          return;
        }

        if (birdsSold > 0) {
          allocationSales.push({
            allocationId: allocation._id,
            birdsSold,
          });
        }
      }

      if (!allocationSales.length) {
        toast.info("No sale was recorded.");
        return;
      }

      const confirmed = window.confirm(
        `Record the sale of ${allocationSales.reduce((sum, item) => sum + item.birdsSold, 0)} birds from flock "${flock.flockId}"?`,
      );

      if (!confirmed) return;

      await sellFlock(flock._id, new Date().toISOString(), allocationSales);

      toast.success("Bird sale recorded successfully.");
      await loadFlocks();
    } catch (error) {
      console.error("SELL FLOCK ERROR:", error);
      toast.error(getErrorMessage(error, "Failed to record flock sale."));
    } finally {
      setActionBusyId(null);
    }
  };

  // ============================================================
  // DELETE FLOCK
  // ============================================================

  const handleDelete = async (flock) => {
    if (!flock?._id || actionBusyId) return;

    const confirmed = window.confirm(
      `Delete flock "${flock.flockId}"? This will soft-delete the record.`,
    );

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

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f7f3] p-4 md:p-6">
      {detailsOpen && (
        <FlockDetailsModal
          flock={selectedFlock}
          allocations={allocations}
          transfers={transfers}
          history={populationHistory}
          loading={detailsLoading}
          error={detailsError}
          onClose={closeDetails}
        />
      )}

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
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={() => (showForm ? resetForm() : setShowForm(true))}
            className="rounded-lg bg-[#39784b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d]"
          >
            {showForm ? "Close Form" : "+ Add New Flock"}
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Active Flocks",
            value: stats.active,
            note: "Currently active flocks",
            color: "text-[#315f3d]",
          },
          {
            label: "Sold Flocks",
            value: stats.sold,
            note: "Completed or sold flocks",
            color: "text-gray-700",
          },
          {
            label: "Deleted Records",
            value: stats.deleted,
            note: "Records available for restoration",
            color: "text-red-600",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[#e1eadf] bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-sm font-medium text-gray-500">{item.label}</p>
            <p className={`mt-3 text-3xl font-bold ${item.color}`}>
              {item.value}
            </p>
            <p className="mt-1 text-xs text-gray-400">{item.note}</p>
          </div>
        ))}
      </div>

      {/* OCCUPIED PEN OVERVIEW */}

      <section className={`${panelClass} p-5`}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#2c4331]">Pen Occupancy</h2>
          <p className="mt-1 text-sm text-gray-500">
            See the legacy pen assignment currently recorded for each flock.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PENS.map((pen) => {
            const matchingFlocks = flocks.filter(
              (item) =>
                item.pen === pen && item.status === "ACTIVE" && !item.isDeleted,
            );

            const isOccupied = matchingFlocks.length > 0;

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

                <div className="mt-2 space-y-1">
                  {isOccupied ? (
                    matchingFlocks.map((flock) => (
                      <button
                        key={flock._id}
                        type="button"
                        onClick={() => handleViewDetails(flock)}
                        className="block text-left text-xs font-medium text-green-800 underline decoration-green-300 underline-offset-2 hover:text-green-950"
                      >
                        {flock.flockId || "Assigned flock"} — View details
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">No active flock</p>
                  )}
                </div>
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
                This is the legacy pen field. Actual housing can be represented
                by multiple flock allocations.
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
                Maximum: {MAX_LAYING_AGE_WEEKS} weeks.
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
                className="rounded-lg bg-[#39784b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:opacity-50"
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
              Select View Details to inspect a flock's complete records.
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
            <h3 className="font-semibold text-gray-700">No flocks found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try another search term."
                : "Register your first flock to get started."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1450px] text-sm">
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
                            <button
                              type="button"
                              onClick={() => handleViewDetails(flock)}
                              disabled={Boolean(actionBusyId)}
                              className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
                            >
                              View Details
                            </button>

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
                                    {busy ? "Processing..." : "Record Sale"}
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
                Use View Details to inspect the allocation and population
                history.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
