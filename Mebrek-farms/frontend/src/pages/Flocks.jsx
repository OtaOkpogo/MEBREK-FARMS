import React, { useEffect, useMemo, useState, useCallback } from "react";

import {
  fetchFlocks,
  fetchFlock,
  fetchFlockAllocations,
  fetchFlockTransfers,
  fetchFlockPopulationHistory,
  fetchPenOccupancySummary,
  createFlock,
  updateFlock,
  sellFlock,
  deleteFlock,
  restoreFlock,
  createFlockPopulationAdjustment,
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
  initialBirdCount: "",
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

const isKnownPopulation = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0;

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

  const allKnown = active.every((allocation) =>
    isKnownPopulation(allocation.currentBirds),
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

const getFlockPopulation = (flock) => {
  const population = flock?.population;

  if (population && typeof population.populationKnown === "boolean") {
    return {
      known: population.populationKnown,
      total: population.populationKnown
        ? Number(population.totalBirds || 0)
        : null,
      activeCount: Number(population.activeAllocationCount || 0),
    };
  }

  return getPopulationSummary(
    Array.isArray(flock?.allocations) ? flock.allocations : [],
  );
};

const getActiveAllocations = (flock) =>
  (Array.isArray(flock?.allocations) ? flock.allocations : []).filter(
    (allocation) => allocation.status === "ACTIVE",
  );

const getActivePenNames = (flock) => {
  const names = getActiveAllocations(flock)
    .map((allocation) => allocation.pen)
    .filter(Boolean);

  return [...new Set(names)];
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
  onCorrectPopulation,
}) {
  const population = useMemo(
    () => getPopulationSummary(allocations),
    [allocations],
  );

  const [correctingAllocationId, setCorrectingAllocationId] = useState(null);
  const [newPopulation, setNewPopulation] = useState("");
  const [adjustmentRemarks, setAdjustmentRemarks] = useState("");
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  if (!flock) return null;

  const openCorrectionForm = (allocation) => {
    setCorrectingAllocationId(allocation._id);

    setNewPopulation(
      isKnownPopulation(allocation.currentBirds)
        ? String(allocation.currentBirds)
        : "",
    );

    setAdjustmentRemarks("");
  };

  const cancelCorrection = () => {
    setCorrectingAllocationId(null);
    setNewPopulation("");
    setAdjustmentRemarks("");
  };

  const submitCorrection = async (allocation) => {
    if (submittingAdjustment) return;

    if (allocation.status !== "ACTIVE") {
      toast.error("Only active allocations can be corrected.");
      return;
    }

    const trimmedPopulation = newPopulation.trim();

    if (trimmedPopulation === "" || !/^\d+$/.test(trimmedPopulation)) {
      toast.error("Enter a valid non-negative whole number.");
      return;
    }

    const confirmedPopulation = Number(trimmedPopulation);

    if (!Number.isSafeInteger(confirmedPopulation)) {
      toast.error("The population value is too large.");
      return;
    }

    const previousPopulation = isKnownPopulation(allocation.currentBirds)
      ? formatNumber(allocation.currentBirds)
      : "Unknown";

    const confirmed = window.confirm(
      `Correct the population for ${allocation.pen || "this allocation"}?\n\n` +
        `Previously recorded: ${previousPopulation}\n` +
        `New confirmed population: ${formatNumber(confirmedPopulation)}\n\n` +
        "This will create a permanent population adjustment history record.",
    );

    if (!confirmed) return;

    try {
      setSubmittingAdjustment(true);

      await onCorrectPopulation({
        allocation,
        newPopulation: confirmedPopulation,
        remarks: adjustmentRemarks.trim(),
      });

      cancelCorrection();
    } catch (error) {
      // The parent handler displays the relevant error notification.
    } finally {
      setSubmittingAdjustment(false);
    }
  };

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
                      : "At least one active allocation has an unknown population"}
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
                  <DetailValue label="Legacy / Initial Pen" value={flock.pen} />
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
                subtitle="Both current and closed allocations are shown here. Correct the population of an active allocation when a physical count confirms a different number."
              >
                {allocations.length === 0 ? (
                  <EmptyMessage>No allocation records found.</EmptyMessage>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-sm">
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
                            "Actions",
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
                          <React.Fragment key={allocation._id}>
                            <tr>
                              <td className="px-3 py-3 font-semibold text-gray-800">
                                {allocation.pen || "—"}
                              </td>

                              <td className="px-3 py-3">
                                {formatNumber(allocation.openingBirds)}
                              </td>

                              <td className="px-3 py-3 font-semibold">
                                {isKnownPopulation(allocation.currentBirds)
                                  ? formatNumber(allocation.currentBirds)
                                  : "Unknown"}
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

                              <td className="px-3 py-3">
                                {allocation.status === "ACTIVE" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        correctingAllocationId ===
                                        allocation._id
                                      ) {
                                        cancelCorrection();
                                      } else {
                                        openCorrectionForm(allocation);
                                      }
                                    }}
                                    disabled={submittingAdjustment}
                                    className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {correctingAllocationId === allocation._id
                                      ? "Cancel Correction"
                                      : "Correct Population"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    Unavailable
                                  </span>
                                )}
                              </td>
                            </tr>

                            {correctingAllocationId === allocation._id && (
                              <tr>
                                <td colSpan={8} className="bg-blue-50/60 p-4">
                                  <div className="rounded-xl border border-blue-200 bg-white p-4">
                                    <div className="mb-4">
                                      <h4 className="font-bold text-gray-800">
                                        Correct Allocation Population
                                      </h4>

                                      <p className="mt-1 text-xs text-gray-500">
                                        {allocation.pen} — {flock.flockId}
                                      </p>
                                    </div>

                                    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                      <div className="rounded-lg bg-gray-50 p-3">
                                        <p className="text-xs text-gray-500">
                                          Previously Recorded Population
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-gray-800">
                                          {isKnownPopulation(
                                            allocation.currentBirds,
                                          )
                                            ? formatNumber(
                                                allocation.currentBirds,
                                              )
                                            : "Unknown"}
                                        </p>
                                      </div>

                                      <div>
                                        <label
                                          htmlFor={`new-population-${allocation._id}`}
                                          className={labelClass}
                                        >
                                          New Confirmed Population
                                        </label>

                                        <input
                                          id={`new-population-${allocation._id}`}
                                          type="number"
                                          min="0"
                                          step="1"
                                          value={newPopulation}
                                          onChange={(event) =>
                                            setNewPopulation(event.target.value)
                                          }
                                          placeholder="Enter physical bird count"
                                          className={inputClass}
                                          disabled={submittingAdjustment}
                                        />
                                      </div>
                                    </div>

                                    <div className="mb-4">
                                      <label
                                        htmlFor={`adjustment-remarks-${allocation._id}`}
                                        className={labelClass}
                                      >
                                        Correction Remarks (Optional)
                                      </label>

                                      <textarea
                                        id={`adjustment-remarks-${allocation._id}`}
                                        rows={3}
                                        value={adjustmentRemarks}
                                        onChange={(event) =>
                                          setAdjustmentRemarks(
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Explain why this population correction is necessary..."
                                        className={inputClass}
                                        disabled={submittingAdjustment}
                                      />
                                    </div>

                                    <div className="flex flex-wrap justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={cancelCorrection}
                                        disabled={submittingAdjustment}
                                        className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          submitCorrection(allocation)
                                        }
                                        disabled={submittingAdjustment}
                                        className="rounded-lg bg-[#39784b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {submittingAdjustment
                                          ? "Saving Correction..."
                                          : "Save Correction"}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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
  const [penOccupancySummary, setPenOccupancySummary] = useState(null);
  const [penOccupancyLoading, setPenOccupancyLoading] = useState(true);
  const [penOccupancyError, setPenOccupancyError] = useState("");

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

  // ============================================================
  // LOAD FLOCKS AND GLOBAL PEN OCCUPANCY
  // ============================================================

  const loadFlocks = useCallback(async (showToast = false) => {
    setLoading(true);
    setPenOccupancyLoading(true);
    setPenOccupancyError("");

    try {
      const [flocksResult, occupancyResult] = await Promise.allSettled([
        fetchFlocks(),
        fetchPenOccupancySummary(),
      ]);

      if (flocksResult.status === "fulfilled") {
        setFlocks(extractFlocks(flocksResult.value));
      } else {
        console.error("LOAD FLOCKS ERROR:", flocksResult.reason);

        toast.error(
          getErrorMessage(flocksResult.reason, "Failed to load flock records."),
        );
      }

      if (occupancyResult.status === "fulfilled") {
        const response = occupancyResult.value;

        setPenOccupancySummary({
          summary: response?.summary || null,
          occupancy: Array.isArray(response?.occupancy)
            ? response.occupancy
            : [],
        });
      } else {
        console.error(
          "LOAD PEN OCCUPANCY SUMMARY ERROR:",
          occupancyResult.reason,
        );

        setPenOccupancySummary(null);

        setPenOccupancyError(
          getErrorMessage(
            occupancyResult.reason,
            "Failed to load global pen occupancy.",
          ),
        );
      }

      if (showToast && flocksResult.status === "fulfilled") {
        toast.success("Flock records refreshed.");
      }
    } finally {
      setLoading(false);
      setPenOccupancyLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlocks();
  }, [loadFlocks]);

  // ============================================================
  // ALLOCATION-BASED PEN OCCUPANCY
  // ============================================================

  const penOccupancy = useMemo(() => {
    const result = Object.fromEntries(PENS.map((pen) => [pen, []]));

    flocks
      .filter((flock) => flock.status === "ACTIVE" && !flock.isDeleted)
      .forEach((flock) => {
        getActiveAllocations(flock).forEach((allocation) => {
          if (!allocation.pen) return;

          if (!result[allocation.pen]) {
            result[allocation.pen] = [];
          }

          result[allocation.pen].push({
            allocationId: allocation._id,
            flockId: flock._id,
            flockCode: flock.flockId,
            pen: allocation.pen,
            currentBirds: allocation.currentBirds,
          });
        });
      });

    return result;
  }, [flocks]);

  // ============================================================
  // GLOBAL PEN OCCUPANCY LOOKUP
  // ============================================================

  const globalOccupancyByPen = useMemo(() => {
    const result = new Map();

    const occupancy = penOccupancySummary?.occupancy || [];

    occupancy.forEach((item) => {
      if (item?.pen) {
        result.set(item.pen, item);
      }
    });

    return result;
  }, [penOccupancySummary]);

  const filteredFlocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return flocks;

    return flocks.filter((flock) => {
      const activePens = getActivePenNames(flock);

      const searchable = [
        flock.flockId,
        flock.pen,
        flock.status,
        flock.lifecycleStatus,
        flock.populationTrackingStatus,
        flock.remarks,
        ...activePens,
      ];

      return searchable
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
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

  // ============================================================
  // CORRECT ALLOCATION POPULATION
  // ============================================================

  const handleCorrectPopulation = async ({
    allocation,
    newPopulation,
    remarks,
  }) => {
    if (!selectedFlock?._id || !allocation?._id) {
      toast.error("Unable to identify the flock allocation.");
      throw new Error("Missing flock or allocation ID.");
    }

    if (allocation.status !== "ACTIVE") {
      toast.error("Only active allocations can be corrected.");
      throw new Error("Allocation is not active.");
    }

    if (!Number.isSafeInteger(newPopulation) || newPopulation < 0) {
      toast.error("Enter a valid non-negative whole number.");
      throw new Error("Invalid population value.");
    }

    try {
      await createFlockPopulationAdjustment(selectedFlock._id, {
        allocationId: allocation._id,
        newPopulation,
        remarks,
      });

      const [
        flockResponse,
        allocationResponse,
        transferResponse,
        historyResponse,
      ] = await Promise.all([
        fetchFlock(selectedFlock._id),
        fetchFlockAllocations(selectedFlock._id),
        fetchFlockTransfers(selectedFlock._id),
        fetchFlockPopulationHistory(selectedFlock._id),
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

      // Refresh flock records and the global pen occupancy summary.
      await loadFlocks();

      toast.success("Allocation population corrected successfully.");
    } catch (error) {
      console.error("POPULATION CORRECTION ERROR:", error);

      toast.error(
        getErrorMessage(error, "Failed to correct allocation population."),
      );

      throw error;
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
      initialBirdCount: "",
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

    if (!editingId && !formData.pen) {
      return toast.error("Please select an initial pen.");
    }

    if (!formData.placementDate) {
      return toast.error("Placement date is required.");
    }

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

    let initialBirdCount;

    if (!editingId && formData.initialBirdCount !== "") {
      initialBirdCount = Number(formData.initialBirdCount);

      if (!Number.isInteger(initialBirdCount) || initialBirdCount < 0) {
        return toast.error(
          "Initial bird count must be a non-negative whole number. Leave it blank if the population is unknown.",
        );
      }
    }

    const payload = {
      flockId,
      placementDate: formData.placementDate,
      startingAgeWeeks: age,
      remarks: formData.remarks.trim(),
    };

    if (!editingId) {
      payload.pen = formData.pen;

      if (initialBirdCount !== undefined) {
        payload.initialBirdCount = initialBirdCount;
      }
    }

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
          `Unable to complete this operation. The conflicting flock is "${existing.flockId}" in "${existing.pen}".`,
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
        (allocation) => !isKnownPopulation(allocation.currentBirds),
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
          `Flock: ${flock.flockId}\nPen: ${allocation.pen}\nAvailable birds: ${formatNumber(available)}\n\nEnter the number of birds sold from this pen. Enter 0 if none were sold.`,
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
            `You cannot sell ${formatNumber(birdsSold)} birds from ${allocation.pen}; only ${formatNumber(available)} are recorded.`,
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

      const totalBirdsSold = allocationSales.reduce(
        (sum, item) => sum + item.birdsSold,
        0,
      );

      const confirmed = window.confirm(
        `Record the sale of ${formatNumber(totalBirdsSold)} birds from flock "${flock.flockId}"?`,
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

  // ============================================================
  // RENDER
  // ============================================================

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
          onCorrectPopulation={handleCorrectPopulation}
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
            Manage poultry flocks, pen allocations, placement dates, population
            and flock lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadFlocks(true)}
            disabled={loading || penOccupancyLoading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {loading || penOccupancyLoading ? "Refreshing..." : "Refresh"}
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

      {/* GLOBAL PEN OCCUPANCY SUMMARY */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-[#e8ede6] bg-[#fbfcfa] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#2c4331]">
                Global Pen Occupancy Summary
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Combined current bird population across all active allocations
                belonging to active, non-deleted flocks.
              </p>
            </div>

            <span className="w-fit rounded-full border border-green-100 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800">
              All Active Flocks
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {penOccupancyLoading ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />

              <p className="mt-3 text-sm text-gray-500">
                Calculating global pen occupancy...
              </p>
            </div>
          ) : penOccupancyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">
                Unable to load global pen occupancy
              </p>

              <p className="mt-1 text-sm text-red-600">{penOccupancyError}</p>

              <button
                type="button"
                onClick={() => loadFlocks()}
                className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* OVERALL SUMMARY */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-green-100 bg-[#f4f8f1] p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Total Current Birds
                  </p>

                  <p
                    className={`mt-2 text-2xl font-bold ${
                      penOccupancySummary?.summary?.populationKnown
                        ? "text-green-800"
                        : "text-amber-700"
                    }`}
                  >
                    {penOccupancySummary?.summary?.populationKnown
                      ? formatNumber(penOccupancySummary.summary.totalBirds)
                      : "Unknown"}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    {penOccupancySummary?.summary?.populationKnown
                      ? "Confirmed combined population"
                      : "At least one pen has an unknown allocation population"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Active Allocations
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-800">
                    {formatNumber(
                      penOccupancySummary?.summary?.totalActiveAllocations,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Across all active flocks
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Active Flocks
                  </p>

                  <p className="mt-2 text-2xl font-bold text-gray-800">
                    {formatNumber(
                      penOccupancySummary?.summary?.totalActiveFlocks,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    With active pen allocations
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-xs font-medium text-gray-500">
                    Pens With Unknown Population
                  </p>

                  <p className="mt-2 text-2xl font-bold text-amber-700">
                    {formatNumber(
                      penOccupancySummary?.summary?.pensWithUnknownPopulation,
                    )}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Require population confirmation
                  </p>
                </div>
              </div>

              {/* PEN-BY-PEN SUMMARY */}

              <div>
                <div className="mb-3">
                  <h3 className="font-bold text-gray-800">Population by Pen</h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Each figure combines every active allocation in that pen.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {PENS.map((pen) => {
                    const penSummary = globalOccupancyByPen.get(pen);

                    const populationKnown =
                      penSummary?.populationKnown !== false;

                    const totalBirds = penSummary?.totalBirds ?? 0;

                    const activeAllocationCount =
                      penSummary?.activeAllocationCount ?? 0;

                    const activeFlockCount = penSummary?.activeFlockCount ?? 0;

                    const unknownAllocationCount =
                      penSummary?.unknownAllocationCount ?? 0;

                    const isOccupied = activeAllocationCount > 0;

                    return (
                      <div
                        key={pen}
                        className={`rounded-xl border p-4 ${
                          !isOccupied
                            ? "border-gray-200 bg-gray-50"
                            : !populationKnown
                              ? "border-amber-200 bg-amber-50/50"
                              : "border-green-100 bg-[#f4f8f1]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-gray-700">
                            {pen}
                          </h4>

                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                              !isOccupied
                                ? "bg-gray-200 text-gray-600"
                                : !populationKnown
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-green-100 text-green-700"
                            }`}
                          >
                            {!isOccupied
                              ? "EMPTY"
                              : !populationKnown
                                ? "UNKNOWN"
                                : "OCCUPIED"}
                          </span>
                        </div>

                        <p
                          className={`mt-3 text-2xl font-bold ${
                            !populationKnown
                              ? "text-amber-700"
                              : "text-[#315f3d]"
                          }`}
                        >
                          {populationKnown
                            ? formatNumber(totalBirds)
                            : "Unknown"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Current birds
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200/70 pt-3">
                          <div>
                            <p className="text-[10px] text-gray-500">
                              Allocations
                            </p>

                            <p className="mt-1 text-sm font-bold text-gray-700">
                              {activeAllocationCount}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] text-gray-500">
                              Active Flocks
                            </p>

                            <p className="mt-1 text-sm font-bold text-gray-700">
                              {activeFlockCount}
                            </p>
                          </div>
                        </div>

                        {unknownAllocationCount > 0 && (
                          <p className="mt-3 rounded-lg bg-amber-100 px-2 py-2 text-xs font-medium text-amber-800">
                            {unknownAllocationCount} allocation
                            {unknownAllocationCount === 1 ? "" : "s"} with
                            unknown population
                          </p>
                        )}

                        {!isOccupied && (
                          <p className="mt-2 text-xs text-gray-500">
                            No active allocations
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ALLOCATION-BASED PEN OCCUPANCY */}

      <section className={`${panelClass} p-5`}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#2c4331]">Pen Occupancy</h2>
          <p className="mt-1 text-sm text-gray-500">
            Occupancy is calculated from active flock allocations. A pen can
            contain multiple flocks, and a flock can occupy multiple pens.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PENS.map((pen) => {
            const matchingAllocations = penOccupancy[pen] || [];
            const isOccupied = matchingAllocations.length > 0;

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
                    {isOccupied
                      ? `${matchingAllocations.length} ALLOCATION${matchingAllocations.length === 1 ? "" : "S"}`
                      : "AVAILABLE"}
                  </span>
                </div>

                <div className="mt-2 space-y-2">
                  {isOccupied ? (
                    matchingAllocations.map((item) => (
                      <div
                        key={
                          item.allocationId ||
                          `${item.flockId}-${item.flockCode}`
                        }
                        className="rounded-md border border-green-100 bg-white px-2 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const flock = flocks.find(
                              (entry) => entry._id === item.flockId,
                            );

                            if (flock) handleViewDetails(flock);
                          }}
                          className="block text-left text-xs font-bold text-green-800 underline decoration-green-300 underline-offset-2 hover:text-green-950"
                        >
                          {item.flockCode || "Assigned flock"} — View details
                        </button>

                        <p className="mt-1 text-xs text-gray-500">
                          Population:{" "}
                          <span className="font-semibold text-gray-700">
                            {isKnownPopulation(item.currentBirds)
                              ? formatNumber(item.currentBirds)
                              : "Unknown"}
                          </span>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">
                      No active flock allocation
                    </p>
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
              {editingId
                ? "Update the flock identity and lifecycle details. Use flock transfers to move birds between pens."
                : "Register the flock and create its initial pen allocation."}
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
                {editingId ? "Initial Pen (Legacy Field)" : "Initial Pen"}
              </label>

              <select
                id="pen"
                name="pen"
                value={formData.pen}
                onChange={handleChange}
                required={!editingId}
                disabled={Boolean(editingId)}
                className={`${inputClass} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
              >
                <option value="">Select Initial Pen</option>

                {PENS.map((pen) => (
                  <option key={pen} value={pen}>
                    {pen}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-gray-400">
                {editingId
                  ? "The initial pen cannot be changed here. Use a flock transfer to move birds to another pen."
                  : "This creates the flock's initial allocation. A pen can have multiple active flock allocations."}
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

            {!editingId && (
              <div>
                <label htmlFor="initialBirdCount" className={labelClass}>
                  Initial Bird Count (Optional)
                </label>

                <input
                  id="initialBirdCount"
                  type="number"
                  name="initialBirdCount"
                  min="0"
                  step="1"
                  value={formData.initialBirdCount}
                  onChange={handleChange}
                  placeholder="Leave blank if unknown"
                  className={inputClass}
                />

                <p className="mt-1 text-xs text-gray-400">
                  Leave blank to record an unknown population. Enter 0 only when
                  the population is confirmed to be zero.
                </p>
              </div>
            )}

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
              Select View Details to inspect a flock's complete allocation and
              population records.
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
              <table className="w-full min-w-[1750px] text-sm">
                <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                  <tr>
                    {[
                      "Flock ID",
                      "Active Pen Allocations",
                      "Current Birds",
                      "Population Tracking",
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
                    const activePens = getActivePenNames(flock);
                    const population = getFlockPopulation(flock);

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

                          <p className="mt-1 text-[10px] text-gray-400">
                            Initial pen: {flock.pen || "—"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {activePens.length ? (
                            <div className="flex max-w-[260px] flex-wrap gap-1">
                              {activePens.map((pen) => (
                                <span
                                  key={pen}
                                  className="rounded-full border border-green-100 bg-green-50 px-2 py-1 text-xs font-medium text-green-800"
                                >
                                  {pen}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              No active allocations
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`font-bold ${
                              population.known
                                ? "text-gray-800"
                                : "text-amber-700"
                            }`}
                          >
                            {population.known
                              ? formatNumber(population.total)
                              : "Unknown"}
                          </span>

                          <p className="mt-1 text-[10px] text-gray-400">
                            {population.activeCount} active allocation
                            {population.activeCount === 1 ? "" : "s"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                              flock.populationTrackingStatus === "TRACKED"
                                ? "border-green-100 bg-green-50 text-green-700"
                                : "border-amber-100 bg-amber-50 text-amber-700"
                            }`}
                          >
                            {flock.populationTrackingStatus || "UNKNOWN"}
                          </span>
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
                Population totals are calculated from active allocations.
              </p>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
