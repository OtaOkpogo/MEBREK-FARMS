import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { PENS } from "../constants/pens";

import {
  fetchProductions,
  createProduction,
  updateProduction,
  deleteProduction,
} from "../services/productionService";

import { fetchFeeds } from "../services/feedInventoryService";

import {
  fetchActiveFlockByPen,
  fetchActiveFlocksByPen,
} from "../services/flockService";

import socket from "../services/socket";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 10;
const BROODING_HOUSE = "Brooding House";
const DAY_MS = 24 * 60 * 60 * 1000;

const BATTERY_CAGE_PENS = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
];

// ============================================================
// EMPTY FORM
// ============================================================

const emptyFormData = {
  pen: "",
  date: "",
  days: "",
  openingStock: "",
  transferIn: "",
  transferOut: "",
  mortality: "",
  sickBirds: "",
  feedUsed: "",
  feedBagsConsumed: "",
  waterConsumed: "",
  drugsUsed: "",
  cratesProduced: "",
  extraEggPieces: "",
  miscarriageProduction: "",
  crackedEggs: "",
  remarks: "",
};

// ============================================================
// HELPERS
// ============================================================

const isBroodingHouse = (pen) => pen === BROODING_HOUSE;

const getCalendarDay = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const calculateDaysFromFlock = (flock, productionDate) => {
  if (!flock?.placementDate || !productionDate) return "";

  const placementDay = getCalendarDay(flock.placementDate);
  const productionDay = getCalendarDay(productionDate);
  const startingAgeWeeks = Number(flock.startingAgeWeeks ?? 0);

  if (
    placementDay === null ||
    productionDay === null ||
    productionDay < placementDay ||
    !Number.isFinite(startingAgeWeeks) ||
    startingAgeWeeks < 0
  ) {
    return "";
  }

  return (
    startingAgeWeeks * 7 + Math.floor((productionDay - placementDay) / DAY_MS)
  );
};

const getFeedReferenceId = (feedUsed) => {
  const feed = feedUsed?.feed ?? feedUsed?.feedId ?? feedUsed;

  if (!feed) return "";
  if (typeof feed === "object") return String(feed._id || feed.id || "");
  return String(feed);
};

const getFeedSnapshotName = (feedUsed) =>
  feedUsed?.feedName ||
  (feedUsed?.feed && typeof feedUsed.feed === "object"
    ? feedUsed.feed.name
    : "") ||
  "";

const getCurrentFeedInventoryItem = (record, feeds) => {
  const feedId = getFeedReferenceId(record?.feedUsed);
  const currentFeed = Array.isArray(feeds)
    ? feeds.find((feed) => String(feed._id) === feedId)
    : null;

  if (currentFeed) return currentFeed;

  return record?.feedUsed?.feed && typeof record.feedUsed.feed === "object"
    ? record.feedUsed.feed
    : null;
};

const toFormData = (record) => ({
  pen: record?.pen || "",
  date: record?.date ? new Date(record.date).toISOString().slice(0, 10) : "",
  days: record?.days ?? "",
  openingStock: record?.openingStock ?? "",
  transferIn: record?.transferIn ?? "",
  transferOut: record?.transferOut ?? "",
  mortality: record?.mortality ?? "",
  sickBirds: record?.sickBirds ?? "",
  feedUsed: getFeedReferenceId(record?.feedUsed),
  feedBagsConsumed: record?.feedBagsConsumed ?? "",
  waterConsumed: record?.waterConsumed ?? "",
  drugsUsed: record?.drugsUsed || "",
  cratesProduced: record?.cratesProduced ?? "",
  extraEggPieces: record?.extraEggPieces ?? "",
  miscarriageProduction: record?.miscarriageProduction ?? "",
  crackedEggs: record?.crackedEggs ?? "",
  remarks: record?.remarks || "",
});

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  });

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-NG") : "—";

// Extract a populated or unpopulated allocation ID.
const getAllocationId = (item) => {
  const allocation = item?.allocation;

  if (!allocation) return "";

  if (typeof allocation === "object") {
    return String(allocation._id || allocation.id || "");
  }

  return String(allocation);
};

// Normalize an allocation returned by the active allocations endpoint.
const normalizeActiveAllocation = (item) => {
  const flock =
    item?.flock && typeof item.flock === "object" ? item.flock : null;

  return {
    allocationId: String(item?._id || ""),
    flockId: flock?.flockId || item?.flockId || "Unknown flock",
    flockName: flock?.name || "",
    pen: item?.pen || flock?.pen || "",
    currentBirds:
      item?.currentBirds === null || item?.currentBirds === undefined
        ? null
        : Number(item.currentBirds),
    numberDead: 0,
    historical: false,
  };
};

// Normalize mortality allocations already saved on a production record.
const normalizeSavedMortality = (item) => {
  const allocation =
    item?.allocation && typeof item.allocation === "object"
      ? item.allocation
      : null;

  const flock =
    allocation?.flock && typeof allocation.flock === "object"
      ? allocation.flock
      : null;

  return {
    allocationId: getAllocationId(item),
    flockId:
      flock?.flockId ||
      allocation?.flockId ||
      item?.flockId ||
      "Historical allocation",
    flockName: flock?.name || "",
    pen: allocation?.pen || item?.pen || "",
    currentBirds:
      allocation?.currentBirds === null ||
      allocation?.currentBirds === undefined
        ? null
        : Number(allocation.currentBirds),
    numberDead: Number(item?.numberDead || 0),
    historical: true,
  };
};

// Merge current active allocations with a record's saved mortality breakdown.
// Saved mortality values take priority, including for allocations no longer active.
const mergeMortalityAllocations = (activeAllocations, savedMortality) => {
  const activeRows = Array.isArray(activeAllocations)
    ? activeAllocations.map(normalizeActiveAllocation)
    : [];

  const savedRows = Array.isArray(savedMortality)
    ? savedMortality.map(normalizeSavedMortality)
    : [];

  const savedById = new Map(
    savedRows
      .filter((row) => row.allocationId)
      .map((row) => [row.allocationId, row]),
  );

  const merged = activeRows.map((row) => {
    const saved = savedById.get(row.allocationId);

    if (!saved) return row;

    savedById.delete(row.allocationId);

    return {
      ...row,
      numberDead: saved.numberDead,
    };
  });

  // Keep historical allocations even if they are no longer active.
  savedById.forEach((row) => {
    merged.push(row);
  });

  return merged;
};

// ============================================================
// COMPONENT
// ============================================================

const Production = () => {
  // ============================================================
  // USER / ROLE
  // ============================================================

  let storedUser = {};

  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    storedUser = {};
  }

  const role = String(storedUser?.role || localStorage.getItem("role") || "")
    .trim()
    .toLowerCase();

  // ============================================================
  // STATE
  // ============================================================

  const [productions, setProductions] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [formData, setFormData] = useState(emptyFormData);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [reportView, setReportView] = useState("All Pens");
  const [currentPage, setCurrentPage] = useState(1);

  const [activeFlock, setActiveFlock] = useState(null);
  const [flockLoading, setFlockLoading] = useState(false);
  const [flockError, setFlockError] = useState("");

  // All active allocations in the selected pen.
  const [mortalityAllocations, setMortalityAllocations] = useState([]);
  const [allocationLoading, setAllocationLoading] = useState(false);
  const [allocationError, setAllocationError] = useState("");

  const broodingHouse = isBroodingHouse(formData.pen);
  const isCombinedBatteryReport = reportView === "Battery Cage Combined";

  // The mortality total is always derived from the allocation breakdown
  // for normal pens. Brooding House retains its existing manual field.
  const allocatedMortality = useMemo(
    () =>
      mortalityAllocations.reduce(
        (sum, item) => sum + Number(item.numberDead || 0),
        0,
      ),
    [mortalityAllocations],
  );

  const mortalityTotal = broodingHouse
    ? Number(formData.mortality || 0)
    : allocatedMortality;

  const selectedFeed = useMemo(
    () =>
      feeds.find((feed) => String(feed._id) === String(formData.feedUsed)) ||
      null,
    [feeds, formData.feedUsed],
  );

  const editingRecord = useMemo(
    () =>
      productions.find((record) => String(record._id) === String(editingId)) ||
      null,
    [productions, editingId],
  );

  const editingFeedId = getFeedReferenceId(editingRecord?.feedUsed);
  const editingFeedQuantity =
    editingFeedId && editingFeedId === String(formData.feedUsed)
      ? Number(editingRecord?.feedBagsConsumed || 0)
      : 0;
  const availableFeedStock = selectedFeed
    ? Number(selectedFeed.quantity || 0) + editingFeedQuantity
    : null;

  // ============================================================
  // STYLES
  // ============================================================

  const inputClass =
    "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100";

  const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

  const panelClass = "rounded-xl border border-[#e5ebe3] bg-white shadow-sm";

  const statCardClass =
    "rounded-xl border border-[#e5ebe3] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

  const previewCardClass =
    "rounded-lg border border-[#e2e9df] bg-[#f7faf5] p-4";

  // ============================================================
  // LOAD PRODUCTIONS
  // ============================================================

  const loadProductions = async (showToast = false) => {
    try {
      setLoading(true);

      const data = await fetchProductions();
      const records = Array.isArray(data) ? data : [];

      setProductions(records);

      if (showToast) {
        toast.success("Production records refreshed");
      }
    } catch (error) {
      console.error("LOAD PRODUCTIONS ERROR:", error);

      toast.error(
        error.response?.data?.message || "Failed to load production records",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD CENTRAL FEED INVENTORY
  // ============================================================

  const loadFeeds = async (showError = true) => {
    try {
      setFeedsLoading(true);
      const data = await fetchFeeds();
      setFeeds(
        Array.isArray(data) ? data.filter((feed) => !feed.isDeleted) : [],
      );
    } catch (error) {
      console.error("LOAD FEEDS ERROR:", error);
      if (showError) {
        toast.error(
          error.response?.data?.message ||
            "Could not load central feed inventory. Feed selection may be unavailable.",
        );
      }
    } finally {
      setFeedsLoading(false);
    }
  };

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadProductions(false);
    loadFeeds(true);
  }, []);

  // ============================================================
  // SOCKET REFRESH
  // ============================================================

  useEffect(() => {
    if (!socket) return;

    const handleProductionUpdate = () => {
      loadProductions(false);
    };

    const handleFeedUpdate = () => {
      loadFeeds(false);
    };

    socket.on("productionCreated", handleProductionUpdate);
    socket.on("productionUpdated", handleProductionUpdate);
    socket.on("productionDeleted", handleProductionUpdate);
    socket.on("feedCreated", handleFeedUpdate);
    socket.on("feedUpdated", handleFeedUpdate);
    socket.on("feedDeleted", handleFeedUpdate);

    return () => {
      socket.off("productionCreated", handleProductionUpdate);
      socket.off("productionUpdated", handleProductionUpdate);
      socket.off("productionDeleted", handleProductionUpdate);
      socket.off("feedCreated", handleFeedUpdate);
      socket.off("feedUpdated", handleFeedUpdate);
      socket.off("feedDeleted", handleFeedUpdate);
    };
  }, []);

  // ============================================================
  // LOAD FLOCK AND ALL ACTIVE ALLOCATIONS
  // ============================================================

  const loadActiveFlock = async (pen, record = null) => {
    setActiveFlock(null);
    setFlockError("");
    setAllocationError("");
    setMortalityAllocations([]);

    if (!pen || pen === BROODING_HOUSE) {
      setFlockLoading(false);
      setAllocationLoading(false);
      return;
    }

    setFlockLoading(true);
    setAllocationLoading(true);

    try {
      // Keep the existing single-flock lookup for the flock information
      // and automatic flock-age calculation.
      const flockPromise = fetchActiveFlockByPen(pen);

      // Use all active allocations for mortality accounting.
      const allocationsPromise = fetchActiveFlocksByPen(pen);

      const [flockResult, allocationsResult] = await Promise.allSettled([
        flockPromise,
        allocationsPromise,
      ]);

      if (flockResult.status === "fulfilled") {
        setActiveFlock(flockResult.value || null);
      } else {
        console.error("ACTIVE FLOCK ERROR:", flockResult.reason);
        setActiveFlock(null);
        setFlockError(
          flockResult.reason?.response?.data?.message ||
            `Failed to load active flock for ${pen}.`,
        );
      }

      if (allocationsResult.status === "fulfilled") {
        const activeRows = Array.isArray(allocationsResult.value)
          ? allocationsResult.value
          : [];

        setMortalityAllocations(
          mergeMortalityAllocations(
            activeRows,
            record?.mortalityAllocations || [],
          ),
        );
      } else {
        console.error(
          "ACTIVE FLOCK ALLOCATIONS ERROR:",
          allocationsResult.reason,
        );

        setAllocationError(
          allocationsResult.reason?.response?.data?.message ||
            `Failed to load active flock allocations for ${pen}.`,
        );

        // Preserve the existing saved breakdown if the active allocation
        // lookup fails while editing a historical record.
        if (Array.isArray(record?.mortalityAllocations)) {
          setMortalityAllocations(
            mergeMortalityAllocations([], record.mortalityAllocations),
          );
        }
      }
    } finally {
      setFlockLoading(false);
      setAllocationLoading(false);
    }
  };

  // ============================================================
  // AUTOMATIC FLOCK AGE / DAYS
  // ============================================================

  useEffect(() => {
    if (broodingHouse || !activeFlock || !formData.date) return;

    const calculatedDays = calculateDaysFromFlock(activeFlock, formData.date);

    if (calculatedDays === "") return;

    setFormData((previous) =>
      String(previous.days) === String(calculatedDays)
        ? previous
        : { ...previous, days: calculatedDays },
    );
  }, [activeFlock, formData.date, broodingHouse]);

  // ============================================================
  // AUTOMATIC OPENING STOCK
  // ============================================================

  useEffect(() => {
    if (!formData.pen || !formData.date || !Array.isArray(productions)) {
      return;
    }

    const selectedDay = getCalendarDay(formData.date);

    if (selectedDay === null) return;

    const previousRecords = productions
      .filter((record) => {
        if (!record || record.isDeleted || record.pen !== formData.pen) {
          return false;
        }

        if (editingId && String(record._id) === String(editingId)) {
          return false;
        }

        const recordDay = getCalendarDay(record.date);

        return recordDay !== null && recordDay < selectedDay;
      })
      .sort((a, b) => getCalendarDay(b.date) - getCalendarDay(a.date));

    if (previousRecords.length === 0) {
      if (!editingId) {
        setFormData((current) => {
          if (current.pen !== formData.pen || current.date !== formData.date) {
            return current;
          }

          return current.openingStock === ""
            ? current
            : { ...current, openingStock: "" };
        });
      }

      return;
    }

    const previousClosingStock = Number(previousRecords[0].closingStock ?? 0);

    setFormData((current) => {
      if (current.pen !== formData.pen || current.date !== formData.date) {
        return current;
      }

      return String(current.openingStock) === String(previousClosingStock)
        ? current
        : {
            ...current,
            openingStock: String(previousClosingStock),
          };
    });
  }, [formData.pen, formData.date, productions, editingId]);

  // ============================================================
  // PEN CHANGE
  // ============================================================

  const handlePenChange = async (e) => {
    const pen = e.target.value;

    setFormData((prev) => ({
      ...prev,
      pen,
      days: "",
      mortality: "",
      openingStock: editingId ? prev.openingStock : "",
      ...(pen === BROODING_HOUSE
        ? {
            cratesProduced: "",
            extraEggPieces: "",
            miscarriageProduction: "",
            crackedEggs: "",
          }
        : {}),
    }));

    setMortalityAllocations([]);
    setAllocationError("");

    await loadActiveFlock(pen);
  };

  // ============================================================
  // GENERIC INPUT CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Mortality for normal pens is allocation-driven and cannot be
    // manually overwritten. Brooding House retains the manual field.
    if (name === "mortality" && !broodingHouse) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // ALLOCATION MORTALITY INPUT
  // ============================================================

  const handleAllocationMortalityChange = (allocationId, value) => {
    const numberDead = value === "" ? 0 : Number(value);

    if (!Number.isFinite(numberDead) || numberDead < 0) return;

    setMortalityAllocations((previous) => {
      const updated = previous.map((item) => {
        if (String(item.allocationId) !== String(allocationId)) {
          return item;
        }

        return {
          ...item,
          numberDead,
        };
      });

      const total = updated.reduce(
        (sum, item) => sum + Number(item.numberDead || 0),
        0,
      );

      setFormData((current) => ({
        ...current,
        mortality: String(total),
      }));

      return updated;
    });
  };

  // ============================================================
  // VALIDATE MORTALITY ALLOCATIONS
  // ============================================================

  const validateMortalityAllocations = () => {
    if (broodingHouse) return true;

    const total = mortalityAllocations.reduce(
      (sum, item) => sum + Number(item.numberDead || 0),
      0,
    );

    if (total !== Number(formData.mortality || 0)) {
      toast.error(
        "Mortality total does not match the allocation breakdown. Review the allocation entries.",
      );
      return false;
    }

    if (total > 0 && mortalityAllocations.length === 0) {
      toast.error(
        "Mortality cannot be recorded without an active flock allocation.",
      );
      return false;
    }

    for (const item of mortalityAllocations) {
      const numberDead = Number(item.numberDead || 0);

      if (!Number.isFinite(numberDead) || numberDead < 0) {
        toast.error(
          "Mortality allocation values must be valid non-negative numbers.",
        );
        return false;
      }

      if (numberDead === 0) continue;

      if (!item.allocationId) {
        toast.error(
          "A mortality entry is missing its allocation reference. Review the allocation breakdown.",
        );
        return false;
      }

      if (item.currentBirds === null || item.currentBirds === undefined) {
        toast.error(
          `The current population for ${item.flockId} is unknown. Mortality cannot be allocated to this flock until its population is known.`,
        );
        return false;
      }

      if (numberDead > Number(item.currentBirds)) {
        toast.error(
          `Mortality for ${item.flockId} cannot exceed its current population of ${formatNumber(item.currentBirds)} birds.`,
        );
        return false;
      }
    }

    return true;
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.pen || !formData.date) {
      toast.error("Please select a pen and production date.");
      return;
    }

    if (
      activeFlock &&
      !broodingHouse &&
      calculateDaysFromFlock(activeFlock, formData.date) === ""
    ) {
      toast.error(
        "The production date cannot be before the flock placement date. Check the date and flock information.",
      );
      return;
    }

    if (!validateMortalityAllocations()) return;

    const feedBags = Number(formData.feedBagsConsumed || 0);
    if (!Number.isFinite(feedBags) || feedBags < 0) {
      toast.error("Feed bags consumed must be a valid non-negative number.");
      return;
    }

    if (feedBags > 0 && !formData.feedUsed) {
      toast.error(
        "Select the feed type used before recording feed consumption.",
      );
      return;
    }

    if (feedBags > 0 && !selectedFeed) {
      toast.error("The selected feed is not available in central inventory.");
      return;
    }

    if (
      feedBags > 0 &&
      selectedFeed &&
      feedBags > Number(availableFeedStock ?? 0)
    ) {
      toast.error(
        `Insufficient ${selectedFeed.name} stock. Available: ${formatNumber(availableFeedStock)} ${selectedFeed.unit || "bags"}.`,
      );
      return;
    }

    const mortality = broodingHouse
      ? Number(formData.mortality || 0)
      : allocatedMortality;

    const calculatedClosingStock =
      Number(formData.openingStock || 0) +
      Number(formData.transferIn || 0) -
      Number(formData.transferOut || 0) -
      mortality;

    if (calculatedClosingStock < 0) {
      toast.error(
        "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      );
      return;
    }

    // The backend determines flock, flockId and flockAgeWeeks.
    // These values are deliberately not sent by the frontend.
    const payload = {
      ...formData,
      days: Number(formData.days || 0),
      openingStock: Number(formData.openingStock || 0),
      transferIn: Number(formData.transferIn || 0),
      transferOut: Number(formData.transferOut || 0),
      mortality,
      sickBirds: Number(formData.sickBirds || 0),
      feedUsed: formData.feedUsed
        ? {
            feed: formData.feedUsed,
            feedName:
              selectedFeed?.name ||
              getFeedSnapshotName(editingRecord?.feedUsed),
          }
        : null,
      feedBagsConsumed: feedBags,
      waterConsumed: Number(formData.waterConsumed || 0),
      cratesProduced: broodingHouse ? 0 : Number(formData.cratesProduced || 0),
      extraEggPieces: broodingHouse ? 0 : Number(formData.extraEggPieces || 0),
      miscarriageProduction: broodingHouse
        ? 0
        : Number(formData.miscarriageProduction || 0),
      crackedEggs: broodingHouse ? 0 : Number(formData.crackedEggs || 0),

      // The backend uses these entries to deduct mortality from the
      // exact flock allocations affected.
      mortalityAllocations: broodingHouse
        ? []
        : mortalityAllocations
            .filter((item) => Number(item.numberDead || 0) > 0)
            .map((item) => ({
              allocation: item.allocationId,
              numberDead: Number(item.numberDead),
            })),
    };

    setSaving(true);

    try {
      if (editingId) {
        const updated = await updateProduction(editingId, payload);

        setProductions((prev) =>
          prev.map((item) => (item._id === editingId ? updated : item)),
        );

        toast.success("Production record updated successfully");
        setEditingId(null);
      } else {
        const created = await createProduction(payload);

        if (created) {
          setProductions((prev) => [created, ...prev]);
        } else {
          await loadProductions(false);
        }

        toast.success("Production record saved successfully");
      }

      // Production consumption changes central warehouse stock on the backend.
      await loadFeeds(false);

      setFormData(emptyFormData);
      setActiveFlock(null);
      setFlockError("");
      setFlockLoading(false);
      setMortalityAllocations([]);
      setAllocationError("");
      setAllocationLoading(false);
      setCurrentPage(1);
    } catch (error) {
      console.error("SAVE PRODUCTION ERROR:", error);

      toast.error(
        error.response?.data?.message || "Failed to save production record",
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // START EDIT
  // ============================================================

  const startEdit = async (record) => {
    setEditingId(record._id);
    setFormData(toFormData(record));
    setActiveFlock(null);
    setFlockError("");
    setMortalityAllocations([]);
    setAllocationError("");

    await loadActiveFlock(record.pen, record);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================================================
  // CANCEL EDIT
  // ============================================================

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(emptyFormData);
    setActiveFlock(null);
    setFlockError("");
    setFlockLoading(false);
    setMortalityAllocations([]);
    setAllocationError("");
    setAllocationLoading(false);
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this production record?",
    );

    if (!confirmed) return;

    try {
      await deleteProduction(id);

      setProductions((prev) =>
        role === "superadmin"
          ? prev.filter((item) => item._id !== id)
          : prev.map((item) =>
              item._id === id ? { ...item, isDeleted: true } : item,
            ),
      );

      toast.success("Production record deleted successfully");

      await Promise.all([loadProductions(false), loadFeeds(false)]);
    } catch (error) {
      console.error("DELETE PRODUCTION ERROR:", error);

      toast.error(
        error.response?.data?.message || "Failed to delete production record",
      );
    }
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredProductions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return productions.filter((record) => {
      const recordDay = getCalendarDay(record?.date);
      const fromDay = dateFrom ? getCalendarDay(dateFrom) : null;
      const toDay = dateTo ? getCalendarDay(dateTo) : null;

      if (fromDay !== null && (recordDay === null || recordDay < fromDay)) {
        return false;
      }

      if (toDay !== null && (recordDay === null || recordDay > toDay)) {
        return false;
      }

      const matchesPen =
        reportView === "All Pens" ||
        (isCombinedBatteryReport
          ? BATTERY_CAGE_PENS.includes(record?.pen)
          : record?.pen === reportView);

      if (!matchesPen) return false;
      if (!query) return true;

      const values = [
        record?.pen,
        record?.flockId,
        record?.flock?.flockId,
        record?.flockAgeWeeks,
        record?.date,
        record?.remarks,
        record?.drugsUsed,
        getFeedSnapshotName(record?.feedUsed),
        record?.feedUsed?.feed?.name,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [
    productions,
    search,
    reportView,
    isCombinedBatteryReport,
    dateFrom,
    dateTo,
  ]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProductions.length / PAGE_SIZE),
  );

  const paginatedProductions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredProductions.slice(start, start + PAGE_SIZE);
  }, [filteredProductions, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const stats = useMemo(() => {
    const activeRecords = productions.filter((item) => !item.isDeleted);

    const totalEggs = activeRecords.reduce(
      (sum, item) => sum + Number(item.totalEggs || 0),
      0,
    );

    const totalMortality = activeRecords.reduce(
      (sum, item) => sum + Number(item.mortality || 0),
      0,
    );

    const totalFeed = activeRecords.reduce(
      (sum, item) => sum + Number(item.feedBagsConsumed || 0),
      0,
    );

    const currentStockByPen = PENS.map((pen) => {
      const latestRecord =
        activeRecords
          .filter((item) => item.pen === pen)
          .sort((a, b) => {
            const dateDifference =
              new Date(b.date).getTime() - new Date(a.date).getTime();

            if (dateDifference !== 0) return dateDifference;

            return (
              new Date(b.updatedAt || b.createdAt || 0).getTime() -
              new Date(a.updatedAt || a.createdAt || 0).getTime()
            );
          })[0] || null;

      return {
        pen,
        currentStock: latestRecord
          ? Number(latestRecord.closingStock || 0)
          : null,
        date: latestRecord?.date || null,
        hasRecord: Boolean(latestRecord),
      };
    });

    return {
      records: activeRecords.length,
      totalEggs,
      totalMortality,
      totalFeed,
      currentStockByPen,
    };
  }, [productions]);

  // ============================================================
  // BATTERY CAGE COMBINED SUMMARY
  // ============================================================

  const batteryCombinedSummary = useMemo(() => {
    const rows = BATTERY_CAGE_PENS.map((pen) => {
      const activeRows = filteredProductions.filter(
        (record) => record.pen === pen && !record.isDeleted,
      );

      const sortedRows = [...activeRows].sort((a, b) => {
        const dateDiff =
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();

        if (dateDiff !== 0) return dateDiff;

        return (
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
      });

      const earliestRows = [...activeRows].sort(
        (a, b) =>
          new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime(),
      );

      const totalEggs = activeRows.reduce(
        (sum, r) => sum + Number(r.totalEggs || 0),
        0,
      );

      const openingStock = earliestRows.length
        ? Number(earliestRows[0].openingStock || 0)
        : 0;

      return {
        pen,
        records: activeRows.length,
        openingStock,
        transferIn: activeRows.reduce(
          (sum, r) => sum + Number(r.transferIn || 0),
          0,
        ),
        transferOut: activeRows.reduce(
          (sum, r) => sum + Number(r.transferOut || 0),
          0,
        ),
        mortality: activeRows.reduce(
          (sum, r) => sum + Number(r.mortality || 0),
          0,
        ),
        closingStock: sortedRows.length
          ? Number(sortedRows[0].closingStock || 0)
          : 0,
        hasStock: sortedRows.length > 0,
        sickBirds: activeRows.reduce(
          (sum, r) => sum + Number(r.sickBirds || 0),
          0,
        ),
        feed: activeRows.reduce(
          (sum, r) => sum + Number(r.feedBagsConsumed || 0),
          0,
        ),
        water: activeRows.reduce(
          (sum, r) => sum + Number(r.waterConsumed || 0),
          0,
        ),
        crates: activeRows.reduce(
          (sum, r) => sum + Number(r.cratesProduced || 0),
          0,
        ),
        extraEggs: activeRows.reduce(
          (sum, r) => sum + Number(r.extraEggPieces || 0),
          0,
        ),
        eggs: totalEggs,
        miscarriage: activeRows.reduce(
          (sum, r) => sum + Number(r.miscarriageProduction || 0),
          0,
        ),
        cracked: activeRows.reduce(
          (sum, r) => sum + Number(r.crackedEggs || 0),
          0,
        ),
        birdDays: activeRows.reduce(
          (sum, r) => sum + Number(r.openingStock || 0),
          0,
        ),
      };
    });

    const sum = (key) =>
      rows.reduce((total, row) => total + Number(row[key] || 0), 0);

    const latestStocks = rows.reduce(
      (total, row) => total + (row.hasStock ? row.closingStock : 0),
      0,
    );

    const totalBirdDays = sum("birdDays");
    const totalEggs = sum("eggs");

    return {
      rows,
      records: sum("records"),
      openingStock: sum("openingStock"),
      transferIn: sum("transferIn"),
      transferOut: sum("transferOut"),
      mortality: sum("mortality"),
      closingStock: latestStocks,
      sickBirds: sum("sickBirds"),
      feed: sum("feed"),
      water: sum("water"),
      crates: sum("crates"),
      extraEggs: sum("extraEggs"),
      eggs: totalEggs,
      productionPercentage:
        totalBirdDays > 0 ? (totalEggs / totalBirdDays) * 100 : 0,
      miscarriage: sum("miscarriage"),
      cracked: sum("cracked"),
    };
  }, [filteredProductions]);

  // ============================================================
  // EXPORT EXCEL
  // ============================================================

  const handleExportExcel = () => {
    if (!filteredProductions.length) {
      toast.info("There are no production records to export.");
      return;
    }

    const data = filteredProductions.map((record) => ({
      Date: record.date ? new Date(record.date).toLocaleDateString() : "",
      Pen: record.pen || "",
      "Flock ID": record.flockId || record.flock?.flockId || "",
      "Flock Age":
        record.flockAgeWeeks !== null && record.flockAgeWeeks !== undefined
          ? `${record.flockAgeWeeks} weeks`
          : "",
      Days: record.days ?? "",
      "Opening Stock": record.openingStock ?? "",
      "Transfer In": record.transferIn ?? 0,
      "Transfer Out": record.transferOut ?? 0,
      Mortality: record.mortality ?? 0,
      "Closing Stock": record.closingStock ?? 0,
      "Sick Birds": record.sickBirds ?? 0,
      "Feed Type":
        getFeedSnapshotName(record.feedUsed) ||
        record.feedUsed?.feed?.name ||
        "",
      "Feed Bags": record.feedBagsConsumed ?? 0,
      "Central Feed Stock Remaining":
        typeof getCurrentFeedInventoryItem(record, feeds)?.quantity === "number"
          ? getCurrentFeedInventoryItem(record, feeds).quantity
          : "",
      "Water Consumed": record.waterConsumed ?? 0,
      "Crates Produced": record.cratesProduced ?? 0,
      "Extra Eggs": record.extraEggPieces ?? 0,
      "Total Eggs": record.totalEggs ?? 0,
      "Production %": record.productionPercentage ?? 0,
      "Miscarriage Production": record.miscarriageProduction ?? 0,
      "Cracked Eggs": record.crackedEggs ?? 0,
      "Drugs Used": record.drugsUsed || "",
      Remarks: record.remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Records");

    if (isCombinedBatteryReport) {
      const summaryRows = [
        { Metric: "Total Eggs", Combined: batteryCombinedSummary.eggs },
        {
          Metric: "Crates Produced",
          Combined: batteryCombinedSummary.crates,
        },
        {
          Metric: "Mortality",
          Combined: batteryCombinedSummary.mortality,
        },
        {
          Metric: "Current Birds (latest closing stock per row)",
          Combined: batteryCombinedSummary.closingStock,
        },
        { Metric: "Feed Bags", Combined: batteryCombinedSummary.feed },
        {
          Metric: "Production Percentage",
          Combined: `${batteryCombinedSummary.productionPercentage.toFixed(2)}%`,
        },
        {
          Metric: "Opening Stock (first record per row)",
          Combined: batteryCombinedSummary.openingStock,
        },
        {
          Metric: "Transfers In",
          Combined: batteryCombinedSummary.transferIn,
        },
        {
          Metric: "Transfers Out",
          Combined: batteryCombinedSummary.transferOut,
        },
        {
          Metric: "Sick Birds",
          Combined: batteryCombinedSummary.sickBirds,
        },
        {
          Metric: "Water Consumed",
          Combined: batteryCombinedSummary.water,
        },
        {
          Metric: "Cracked Eggs",
          Combined: batteryCombinedSummary.cracked,
        },
        ...batteryCombinedSummary.rows.map((row) => ({
          Pen: row.pen,
          Records: row.records,
          "Total Eggs": row.eggs,
          Crates: row.crates,
          Mortality: row.mortality,
          "Feed Bags": row.feed,
          "Current Birds": row.hasStock ? row.closingStock : "—",
          "Cracked Eggs": row.cracked,
        })),
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(summaryRows),
        "Combined Summary",
      );
    }

    XLSX.writeFile(
      workbook,
      isCombinedBatteryReport
        ? "battery-cage-combined-production.xlsx"
        : "production-records.xlsx",
    );

    toast.success("Production records exported to Excel");
  };

  // ============================================================
  // EXPORT PDF
  // ============================================================

  const handleExportPDF = () => {
    if (!filteredProductions.length) {
      toast.info("There are no production records to export.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(16);

    doc.text(
      isCombinedBatteryReport
        ? "Battery Cage Combined Production Report"
        : "Production Records",
      14,
      15,
    );

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);

    let detailStartY = 26;

    if (isCombinedBatteryReport) {
      autoTable(doc, {
        startY: 26,
        head: [
          [
            "Combined Metric",
            "Value",
            "Pen",
            "Records",
            "Eggs",
            "Crates",
            "Mortality",
            "Feed Bags",
            "Current Birds",
          ],
        ],
        body: [
          ["Combined totals", "", "", "", "", "", "", "", ""],
          [
            "Total Eggs",
            batteryCombinedSummary.eggs,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ],
          [
            "Crates Produced",
            batteryCombinedSummary.crates,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ],
          [
            "Mortality",
            batteryCombinedSummary.mortality,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ],
          [
            "Production %",
            `${batteryCombinedSummary.productionPercentage.toFixed(2)}%`,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ],
          ...batteryCombinedSummary.rows.map((row) => [
            "Row breakdown",
            "",
            row.pen,
            row.records,
            row.eggs,
            row.crates,
            row.mortality,
            row.feed,
            row.hasStock ? row.closingStock : "—",
          ]),
        ],
        styles: { fontSize: 7, cellPadding: 1.5 },
        margin: { left: 8, right: 8 },
      });

      detailStartY = (doc.lastAutoTable?.finalY || 60) + 6;

      if (detailStartY > 170) {
        doc.addPage();
        detailStartY = 15;
      }
    }

    const rows = filteredProductions.map((record) => [
      record.date ? new Date(record.date).toLocaleDateString() : "",
      record.pen || "",
      record.flockId || record.flock?.flockId || "—",
      record.flockAgeWeeks !== null && record.flockAgeWeeks !== undefined
        ? `${record.flockAgeWeeks} w`
        : "—",
      record.days ?? "",
      record.openingStock ?? 0,
      record.transferIn ?? 0,
      record.transferOut ?? 0,
      record.mortality ?? 0,
      record.closingStock ?? 0,
      record.cratesProduced ?? 0,
      record.extraEggPieces ?? 0,
      record.totalEggs ?? 0,
      record.productionPercentage !== undefined
        ? `${record.productionPercentage}%`
        : "0%",
    ]);

    autoTable(doc, {
      startY: detailStartY,
      head: [
        [
          "Date",
          "Pen",
          "Flock ID",
          "Flock Age",
          "Days",
          "Opening",
          "In",
          "Out",
          "Mortality",
          "Closing",
          "Crates",
          "Extra",
          "Total Eggs",
          "Production %",
        ],
      ],
      body: rows,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fontSize: 7,
      },
      margin: {
        left: 8,
        right: 8,
      },
    });

    doc.save(
      isCombinedBatteryReport
        ? "battery-cage-combined-production.pdf"
        : "production-records.pdf",
    );

    toast.success("Production records exported to PDF");
  };

  // ============================================================
  // CALCULATED FORM VALUES
  // ============================================================

  const calculatedClosingStock =
    Number(formData.openingStock || 0) +
    Number(formData.transferIn || 0) -
    Number(formData.transferOut || 0) -
    mortalityTotal;

  const calculatedTotalEggs =
    Number(formData.cratesProduced || 0) * 30 +
    Number(formData.extraEggPieces || 0);

  const calculatedProductionPercentage =
    calculatedClosingStock > 0
      ? (calculatedTotalEggs / calculatedClosingStock) * 100
      : 0;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f7f3] p-4 md:p-6">
      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 rounded-xl border border-[#e5ebe3] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-[#eaf2e7] px-3 py-1 text-xs font-semibold text-[#315f3d]">
              FARM OPERATIONS
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[#263b2b] md:text-3xl">
            Poultry Production
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            Record daily production, stock movement, mortality and flock
            performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadProductions(true)}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="rounded-lg bg-[#39784b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d633d]"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="rounded-lg bg-[#a94b43] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#913d36]"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* REPORT VIEW */}

      <div className="rounded-xl border border-[#dce8d8] bg-[#edf4e9] p-4 shadow-sm">
        <label
          htmlFor="productionReportView"
          className="mb-2 block text-sm font-bold text-[#31543a]"
        >
          Production Report View
        </label>

        <select
          id="productionReportView"
          value={reportView}
          onChange={(e) => {
            setReportView(e.target.value);
            setCurrentPage(1);
          }}
          className={`${inputClass} w-full md:max-w-xl`}
        >
          <option value="All Pens">All Pens — Individual Records</option>
          <option value="Battery Cage Combined">
            Battery Cage Combined Report (Rows 1–3)
          </option>
          {PENS.map((pen) => (
            <option key={pen} value={pen}>
              {pen} — Individual Report
            </option>
          ))}
        </select>

        {isCombinedBatteryReport && (
          <p className="mt-2 text-sm text-[#42694a]">
            Combined report selected: Battery Cage Rows 1, 2 and 3. Original
            individual production records are preserved.
          </p>
        )}
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={statCardClass}>
          <p className="text-sm font-medium text-gray-500">
            Production Records
          </p>
          <p className="mt-2 text-2xl font-bold text-[#315f3d]">
            {formatNumber(stats.records)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Active records</p>
        </div>

        <div className={statCardClass}>
          <p className="text-sm font-medium text-gray-500">Total Eggs</p>
          <p className="mt-2 text-2xl font-bold text-[#315f3d]">
            {formatNumber(stats.totalEggs)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Eggs recorded across all pens
          </p>
        </div>

        <div className={statCardClass}>
          <p className="text-sm font-medium text-gray-500">Total Mortality</p>
          <p className="mt-2 text-2xl font-bold text-[#a94b43]">
            {formatNumber(stats.totalMortality)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Recorded bird losses</p>
        </div>

        <div className={statCardClass}>
          <p className="text-sm font-medium text-gray-500">
            Feed Bags Consumed
          </p>
          <p className="mt-2 text-2xl font-bold text-[#9a742e]">
            {formatNumber(stats.totalFeed)}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Decimal quantities included
          </p>
        </div>
      </div>

      {/* CURRENT STOCK BY PEN */}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-[#2c4331]">
            Current Stock by Pen
          </h2>
          <p className="text-sm text-gray-500">
            Latest closing stock recorded for each pen.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.currentStockByPen.map((item) => (
            <div
              key={item.pen}
              className="rounded-xl border border-[#e5ebe3] bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-600">{item.pen}</p>

              {item.hasRecord ? (
                <>
                  <p className="mt-2 text-2xl font-bold text-[#315f3d]">
                    {formatNumber(item.currentStock)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    As of {formatDate(item.date)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-medium text-gray-400">
                  No production record yet
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTION FORM */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#e8ede6] bg-[#fbfcfa] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#2c4331]">
              {editingId ? "Edit Production Record" : "Add Production Record"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Enter the daily production and stock information below.
            </p>

            {editingId && (
              <p className="mt-2 text-sm font-medium text-blue-600">
                You are editing an existing production record.
              </p>
            )}
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3"
        >
          {/* PEN */}

          <div>
            <label htmlFor="pen" className={labelClass}>
              Pen
            </label>

            <select
              id="pen"
              name="pen"
              value={formData.pen}
              onChange={handlePenChange}
              required
              className={inputClass}
            >
              <option value="">Select pen</option>
              {PENS.map((pen) => (
                <option key={pen} value={pen}>
                  {pen}
                </option>
              ))}
            </select>
          </div>

          {/* ACTIVE FLOCK */}

          {formData.pen && (
            <div className="rounded-xl border border-[#dce8d8] bg-[#f5f9f2] p-4 md:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-bold text-[#31543a]">
                  Active Flock Information
                </h3>

                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#54765a]">
                  {broodingHouse ? "Not Required" : "Flock Details"}
                </span>
              </div>

              {flockLoading ? (
                <p className="text-sm text-gray-600">Loading active flock...</p>
              ) : flockError ? (
                <p className="text-sm text-red-600">{flockError}</p>
              ) : activeFlock ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Flock ID", activeFlock.flockId || "—"],
                    ["Pen", activeFlock.pen || "—"],
                    [
                      "Current Age",
                      `${activeFlock.currentAgeWeeks ?? "—"} ${
                        activeFlock.currentAgeWeeks !== undefined ? "weeks" : ""
                      }`,
                    ],
                    ["Lifecycle", activeFlock.lifecycleStatus || "—"],
                    [
                      "Starting Age",
                      `${activeFlock.startingAgeWeeks ?? "—"} weeks`,
                    ],
                    ["Placement Date", formatDate(activeFlock.placementDate)],
                    [
                      "Weeks Remaining",
                      `${activeFlock.weeksRemaining ?? "—"} weeks`,
                    ],
                    [
                      "Expected End of Lay",
                      formatDate(activeFlock.expectedEndOfLay),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-sm font-bold text-gray-800">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : broodingHouse ? (
                <p className="text-sm text-gray-600">
                  Brooding House does not require an active flock for production
                  records.
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  No active flock is currently assigned to this pen. Production
                  can still be recorded.
                </p>
              )}
            </div>
          )}

          {/* DATE */}

          <div>
            <label htmlFor="date" className={labelClass}>
              Production Date
            </label>
            <input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          {/* DAYS */}

          <div>
            <label htmlFor="days" className={labelClass}>
              Days
            </label>
            <input
              id="days"
              type="number"
              min="0"
              name="days"
              value={formData.days}
              onChange={handleChange}
              readOnly={Boolean(activeFlock) && !broodingHouse}
              required
              className={`${inputClass} ${
                activeFlock && !broodingHouse
                  ? "cursor-not-allowed bg-gray-100"
                  : ""
              }`}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              {activeFlock && !broodingHouse
                ? "Calculated automatically from flock age and production date."
                : broodingHouse
                  ? "Enter age in days manually for the Brooding House."
                  : flockLoading
                    ? "Waiting for flock information..."
                    : "Enter Days manually because no active flock is available."}
            </p>
          </div>

          {/* OPENING STOCK */}

          <div>
            <label htmlFor="openingStock" className={labelClass}>
              Opening Stock
            </label>
            <input
              id="openingStock"
              type="number"
              min="0"
              name="openingStock"
              value={formData.openingStock}
              onChange={handleChange}
              required
              className={inputClass}
              placeholder={
                formData.pen && formData.date
                  ? "Loading previous stock if available..."
                  : "Select a pen and date first"
              }
            />
          </div>

          {/* TRANSFER IN */}

          <div>
            <label htmlFor="transferIn" className={labelClass}>
              Transfer In
            </label>
            <input
              id="transferIn"
              type="number"
              min="0"
              name="transferIn"
              value={formData.transferIn}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* TRANSFER OUT */}

          <div>
            <label htmlFor="transferOut" className={labelClass}>
              Transfer Out
            </label>
            <input
              id="transferOut"
              type="number"
              min="0"
              name="transferOut"
              value={formData.transferOut}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* ALLOCATION-BASED MORTALITY */}

          <div className="rounded-xl border border-[#e5ebe3] bg-[#fbfcfa] p-4 md:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className={labelClass}>Mortality Allocation</label>
                <p className="text-xs text-gray-500">
                  Record deaths against the specific flock allocation in this
                  pen. The total is calculated automatically.
                </p>
              </div>

              <div className="rounded-lg bg-[#fbeeed] px-4 py-2 text-right">
                <p className="text-xs font-medium text-[#98524b]">
                  Total Mortality
                </p>
                <p className="text-xl font-bold text-[#a94b43]">
                  {formatNumber(mortalityTotal)}
                </p>
              </div>
            </div>

            {broodingHouse ? (
              <div className="max-w-sm">
                <label htmlFor="mortality" className={labelClass}>
                  Brooding House Mortality
                </label>
                <input
                  id="mortality"
                  type="number"
                  min="0"
                  step="1"
                  name="mortality"
                  value={formData.mortality}
                  onChange={handleChange}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Brooding House has no flock allocation breakdown, so mortality
                  remains a manual entry here.
                </p>
              </div>
            ) : allocationLoading ? (
              <p className="rounded-lg bg-white p-3 text-sm text-gray-600">
                Loading active flock allocations for {formData.pen}...
              </p>
            ) : allocationError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {allocationError} Mortality cannot be allocated until the
                allocation information is available.
              </p>
            ) : mortalityAllocations.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No active flock allocations were found for this pen. You can
                record production with zero mortality, but positive mortality
                requires a valid flock allocation.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-[#e5ebe3] bg-white">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                      <tr>
                        <th className="px-3 py-3 font-semibold">Flock</th>
                        <th className="px-3 py-3 font-semibold">Pen</th>
                        <th className="px-3 py-3 font-semibold">
                          Current Population
                        </th>
                        <th className="px-3 py-3 font-semibold">Number Dead</th>
                        <th className="px-3 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {mortalityAllocations.map((item) => {
                        const populationKnown =
                          item.currentBirds !== null &&
                          item.currentBirds !== undefined &&
                          Number.isFinite(Number(item.currentBirds));

                        const exceedsPopulation =
                          populationKnown &&
                          Number(item.numberDead || 0) >
                            Number(item.currentBirds);

                        return (
                          <tr
                            key={
                              item.allocationId || `${item.flockId}-${item.pen}`
                            }
                            className="align-middle"
                          >
                            <td className="px-3 py-3">
                              <p className="font-semibold text-gray-800">
                                {item.flockId}
                              </p>
                              {item.historical && (
                                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                  Historical allocation
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-gray-600">
                              {item.pen || formData.pen}
                            </td>

                            <td className="px-3 py-3 font-medium text-gray-700">
                              {populationKnown
                                ? formatNumber(item.currentBirds)
                                : "Unknown"}
                            </td>

                            <td className="px-3 py-3">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.numberDead || ""}
                                disabled={
                                  !populationKnown || !item.allocationId
                                }
                                onChange={(e) =>
                                  handleAllocationMortalityChange(
                                    item.allocationId,
                                    e.target.value,
                                  )
                                }
                                className={`${inputClass} max-w-36 ${
                                  exceedsPopulation
                                    ? "border-red-400 focus:border-red-500 focus:ring-red-100"
                                    : ""
                                }`}
                                aria-label={`Mortality for ${item.flockId}`}
                              />

                              {exceedsPopulation && (
                                <p className="mt-1 text-xs text-red-600">
                                  Exceeds available population.
                                </p>
                              )}
                            </td>

                            <td className="px-3 py-3">
                              {!item.allocationId ? (
                                <span className="text-xs font-medium text-red-600">
                                  Missing allocation ID
                                </span>
                              ) : !populationKnown ? (
                                <span className="text-xs font-medium text-amber-700">
                                  Population unknown
                                </span>
                              ) : item.historical ? (
                                <span className="text-xs font-medium text-amber-700">
                                  Historical
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-green-700">
                                  Available
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot className="bg-[#f7faf5]">
                      <tr>
                        <td
                          colSpan="3"
                          className="px-3 py-3 text-right font-bold text-gray-700"
                        >
                          Total Allocated Mortality
                        </td>
                        <td className="px-3 py-3 font-bold text-[#a94b43]">
                          {formatNumber(allocatedMortality)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <p className="text-xs leading-5 text-gray-500">
                  Each mortality entry is linked to its own flock allocation.
                  Allocations with unknown populations are disabled. Historical
                  allocations are retained when editing previously saved
                  production records.
                </p>
              </div>
            )}
          </div>

          {/* SICK BIRDS */}

          <div>
            <label htmlFor="sickBirds" className={labelClass}>
              Sick Birds
            </label>
            <input
              id="sickBirds"
              type="number"
              min="0"
              name="sickBirds"
              value={formData.sickBirds}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* FEED TYPE AND CENTRAL INVENTORY CONSUMPTION */}

          <div>
            <label htmlFor="feedUsed" className={labelClass}>
              Feed Type Used
            </label>
            <select
              id="feedUsed"
              name="feedUsed"
              value={formData.feedUsed}
              onChange={handleChange}
              className={inputClass}
              disabled={feedsLoading}
            >
              <option value="">Select feed type</option>
              {feeds.map((feed) => (
                <option key={feed._id} value={feed._id}>
                  {feed.name} ({formatNumber(feed.quantity)}{" "}
                  {feed.unit || "bags"} available)
                </option>
              ))}
            </select>
            {feedsLoading ? (
              <p className="mt-1 text-xs text-gray-400">
                Loading central feed inventory...
              </p>
            ) : feeds.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                No active feed items found. Add feed stock in Feed Inventory
                first.
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="feedBagsConsumed" className={labelClass}>
              Feed Bags Consumed
            </label>
            <input
              id="feedBagsConsumed"
              type="number"
              min="0"
              step="0.01"
              name="feedBagsConsumed"
              value={formData.feedBagsConsumed}
              onChange={handleChange}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              Decimal values are allowed, e.g. 0.5 or 1.25.
            </p>
            {selectedFeed && (
              <div className="mt-2 rounded-lg border border-[#e2e9df] bg-[#f7faf5] p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">
                    Central stock before this entry
                  </span>
                  <strong className="text-[#315f3d]">
                    {formatNumber(availableFeedStock)}{" "}
                    {selectedFeed.unit || "bags"}
                  </strong>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-600">
                    Estimated stock after this entry
                  </span>
                  <strong className="text-[#315f3d]">
                    {formatNumber(
                      availableFeedStock -
                        Number(formData.feedBagsConsumed || 0),
                    )}{" "}
                    {selectedFeed.unit || "bags"}
                  </strong>
                </div>
                {Number(formData.feedBagsConsumed || 0) >
                  Number(availableFeedStock || 0) && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    Consumption exceeds available central stock.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* WATER */}

          <div>
            <label htmlFor="waterConsumed" className={labelClass}>
              Water Consumed
            </label>
            <input
              id="waterConsumed"
              type="number"
              min="0"
              name="waterConsumed"
              value={formData.waterConsumed}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* DRUGS */}

          <div>
            <label htmlFor="drugsUsed" className={labelClass}>
              Drugs Used
            </label>
            <input
              id="drugsUsed"
              type="text"
              name="drugsUsed"
              value={formData.drugsUsed}
              onChange={handleChange}
              className={inputClass}
            />
          </div>

          {/* EGG PRODUCTION */}

          {!broodingHouse && (
            <>
              <div>
                <label htmlFor="cratesProduced" className={labelClass}>
                  Crates Produced
                </label>
                <input
                  id="cratesProduced"
                  type="number"
                  min="0"
                  name="cratesProduced"
                  value={formData.cratesProduced}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="extraEggPieces" className={labelClass}>
                  Extra Egg Pieces
                </label>
                <input
                  id="extraEggPieces"
                  type="number"
                  min="0"
                  name="extraEggPieces"
                  value={formData.extraEggPieces}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="miscarriageProduction" className={labelClass}>
                  Miscarriage Production
                </label>
                <input
                  id="miscarriageProduction"
                  type="number"
                  min="0"
                  name="miscarriageProduction"
                  value={formData.miscarriageProduction}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="crackedEggs" className={labelClass}>
                  Cracked Eggs
                </label>
                <input
                  id="crackedEggs"
                  type="number"
                  min="0"
                  name="crackedEggs"
                  value={formData.crackedEggs}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* CALCULATED PREVIEWS */}

          <div className={previewCardClass}>
            <p className="text-sm font-medium text-gray-500">
              Calculated Closing Stock
            </p>
            <p className="mt-2 text-2xl font-bold text-[#315f3d]">
              {formatNumber(Math.max(0, calculatedClosingStock))}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Opening + transfers in − transfers out − mortality
            </p>
          </div>

          {!broodingHouse && (
            <div className={previewCardClass}>
              <p className="text-sm font-medium text-gray-500">
                Calculated Total Eggs
              </p>
              <p className="mt-2 text-2xl font-bold text-[#315f3d]">
                {formatNumber(calculatedTotalEggs)}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Crates × 30 + extra egg pieces
              </p>
            </div>
          )}

          {!broodingHouse && (
            <div className={previewCardClass}>
              <p className="text-sm font-medium text-gray-500">
                Production Percentage
              </p>
              <p className="mt-2 text-2xl font-bold text-[#315f3d]">
                {calculatedProductionPercentage.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Calculated using closing stock
              </p>
            </div>
          )}

          {/* REMARKS */}

          <div className="md:col-span-3">
            <label htmlFor="remarks" className={labelClass}>
              Remarks
            </label>
            <textarea
              id="remarks"
              name="remarks"
              rows="3"
              value={formData.remarks}
              onChange={handleChange}
              className={inputClass}
              placeholder="Optional remarks..."
            />
          </div>

          {/* FORM ACTIONS */}

          <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4 md:col-span-3">
            <button
              type="submit"
              disabled={
                saving ||
                allocationLoading ||
                (!broodingHouse && Boolean(allocationError))
              }
              className="rounded-lg bg-[#39784b] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Production"
                  : "Save Production"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* PRODUCTION RECORDS */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-[#e8ede6] bg-[#fbfcfa] p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#2c4331]">
              Production Records
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Flock information shown here is the information saved with each
              production record.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 xl:w-auto">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Report start date"
                className={inputClass}
              />

              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Report end date"
                className={inputClass}
              />

              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setCurrentPage(1);
                  }}
                  className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Clear dates
                </button>
              )}
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search pen, flock, remarks..."
              className={inputClass}
            />
          </div>
        </div>

        {/* BATTERY CAGE COMBINED REPORT */}

        {isCombinedBatteryReport && (
          <div className="space-y-4 border-b border-[#e5ebe3] bg-[#f5f8f2] p-5">
            <div>
              <h3 className="text-lg font-bold text-[#2c4331]">
                Battery Cage Combined Summary
              </h3>
              <p className="text-sm text-gray-500">
                Combined from active records for Rows 1–3. Individual production
                records remain unchanged below.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {[
                ["Total Eggs", batteryCombinedSummary.eggs],
                ["Crates Produced", batteryCombinedSummary.crates],
                ["Mortality", batteryCombinedSummary.mortality],
                ["Current Birds", batteryCombinedSummary.closingStock],
                ["Feed Bags", batteryCombinedSummary.feed],
                [
                  "Production %",
                  `${batteryCombinedSummary.productionPercentage.toFixed(2)}%`,
                ],
                ["Opening Stock*", batteryCombinedSummary.openingStock],
                ["Transfers In", batteryCombinedSummary.transferIn],
                ["Transfers Out", batteryCombinedSummary.transferOut],
                ["Sick Birds", batteryCombinedSummary.sickBirds],
                ["Water Consumed", batteryCombinedSummary.water],
                ["Cracked Eggs", batteryCombinedSummary.cracked],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#e2e9df] bg-white p-3"
                >
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-[#315f3d]">
                    {typeof value === "number" ? formatNumber(value) : value}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-[#e2e9df] bg-white">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                  <tr>
                    {[
                      "Pen",
                      "Records",
                      "Total Eggs",
                      "Crates",
                      "Mortality",
                      "Feed Bags",
                      "Current Birds",
                      "Cracked Eggs",
                    ].map((heading) => (
                      <th key={heading} className="px-3 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {batteryCombinedSummary.rows.map((row) => (
                    <tr key={row.pen} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-semibold text-gray-700">
                        {row.pen}
                      </td>
                      <td className="px-3 py-3">{row.records}</td>
                      <td className="px-3 py-3">{formatNumber(row.eggs)}</td>
                      <td className="px-3 py-3">{formatNumber(row.crates)}</td>
                      <td className="px-3 py-3">
                        {formatNumber(row.mortality)}
                      </td>
                      <td className="px-3 py-3">{formatNumber(row.feed)}</td>
                      <td className="px-3 py-3">
                        {row.hasStock ? formatNumber(row.closingStock) : "—"}
                      </td>
                      <td className="px-3 py-3">{formatNumber(row.cracked)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs leading-5 text-gray-500">
              *Opening stock shows the first recorded opening stock per row in
              the current result set. Current birds sums each row's latest
              closing stock. Production % is a weighted estimate using recorded
              opening-stock values and should be interpreted as an overall
              indicator for the selected records.
            </p>
          </div>
        )}

        {/* RECORD TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1580px] text-sm">
            <thead className="bg-[#edf3e9] text-left text-[#38563d]">
              <tr>
                {[
                  "Date",
                  "Pen",
                  "Flock ID",
                  "Flock Age",
                  "Days",
                  "Opening",
                  "Transfer In",
                  "Transfer Out",
                  "Mortality",
                  "Closing",
                  "Sick",
                  "Feed",
                  "Water",
                  "Crates",
                  "Extra Eggs",
                  "Total Eggs",
                  "Production %",
                  "Miscarriage",
                  "Cracked",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="whitespace-nowrap px-4 py-3 font-semibold"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="21"
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    Loading production records...
                  </td>
                </tr>
              ) : paginatedProductions.length === 0 ? (
                <tr>
                  <td
                    colSpan="21"
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No production records found.
                  </td>
                </tr>
              ) : (
                paginatedProductions.map((record) => (
                  <tr
                    key={record._id}
                    className={
                      record.isDeleted
                        ? "bg-red-50/70"
                        : "transition hover:bg-[#f7faf5]"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(record.date)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-700">
                      {record.pen || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {record.flockId || record.flock?.flockId || "—"}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {record.flockAgeWeeks !== null &&
                      record.flockAgeWeeks !== undefined
                        ? `${record.flockAgeWeeks} weeks`
                        : "—"}
                    </td>

                    <td className="px-4 py-3">{record.days ?? 0}</td>

                    <td className="px-4 py-3">
                      {formatNumber(record.openingStock)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.transferIn)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.transferOut)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.mortality)}
                    </td>

                    <td className="px-4 py-3 font-semibold text-[#315f3d]">
                      {formatNumber(record.closingStock)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.sickBirds)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-700">
                        {getFeedSnapshotName(record.feedUsed) ||
                          record.feedUsed?.feed?.name ||
                          "Not recorded"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatNumber(record.feedBagsConsumed)} bags consumed
                      </div>
                      {getCurrentFeedInventoryItem(record, feeds) &&
                        typeof getCurrentFeedInventoryItem(record, feeds)
                          .quantity === "number" && (
                          <div className="mt-1 text-xs font-medium text-[#315f3d]">
                            Central remaining:{" "}
                            {formatNumber(
                              getCurrentFeedInventoryItem(record, feeds)
                                .quantity,
                            )}{" "}
                            {getCurrentFeedInventoryItem(record, feeds).unit ||
                              "bags"}
                          </div>
                        )}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.waterConsumed)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.cratesProduced)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.extraEggPieces)}
                    </td>

                    <td className="px-4 py-3 font-semibold text-[#315f3d]">
                      {formatNumber(record.totalEggs)}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.productionPercentage || 0).toFixed(2)}%
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.miscarriageProduction)}
                    </td>

                    <td className="px-4 py-3">
                      {formatNumber(record.crackedEggs)}
                    </td>

                    <td className="whitespace-nowrap px-4 py-3">
                      {record.isDeleted ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Deleted
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#e7f3e7] px-2.5 py-1 text-xs font-semibold text-[#347044]">
                          Active
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {!record.isDeleted && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(record._id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}

                      {record.isDeleted && role === "superadmin" && (
                        <span className="text-xs text-gray-500">
                          Deleted record
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        {filteredProductions.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[#e8ede6] bg-[#fbfcfa] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filteredProductions.length)} of{" "}
              {filteredProductions.length} records
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-2 text-sm font-medium text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Production;
