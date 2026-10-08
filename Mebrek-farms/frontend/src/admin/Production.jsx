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

import { fetchActiveFlockByPen } from "../services/flockService";

import socket from "../services/socket";

// ============================================================
// CONSTANTS
// ============================================================

const PAGE_SIZE = 10;

const BROODING_HOUSE = "Brooding House";

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

const isBroodingHouse = (pen) => {
  return pen === BROODING_HOUSE;
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
  feedBagsConsumed: record?.feedBagsConsumed ?? "",
  waterConsumed: record?.waterConsumed ?? "",
  drugsUsed: record?.drugsUsed || "",
  cratesProduced: record?.cratesProduced ?? "",
  extraEggPieces: record?.extraEggPieces ?? "",
  miscarriageProduction: record?.miscarriageProduction ?? "",
  crackedEggs: record?.crackedEggs ?? "",
  remarks: record?.remarks || "",
});

// ============================================================
// COMPONENT
// ============================================================

const Production = () => {
  // ============================================================
  // USER / ROLE
  // ============================================================

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user?.role || localStorage.getItem("role");

  // ============================================================
  // STATE
  // ============================================================

  const [productions, setProductions] = useState([]);

  const [formData, setFormData] = useState(emptyFormData);

  const broodingHouse = isBroodingHouse(formData.pen);

  const [editingId, setEditingId] = useState(null);

  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  // ============================================================
  // ACTIVE FLOCK STATE
  // ============================================================

  const [activeFlock, setActiveFlock] = useState(null);

  const [flockLoading, setFlockLoading] = useState(false);

  const [flockError, setFlockError] = useState("");

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
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadProductions(false);
  }, []);

  // ============================================================
  // SOCKET REFRESH
  // ============================================================

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleProductionUpdate = () => {
      loadProductions(false);
    };

    socket.on("productionCreated", handleProductionUpdate);

    socket.on("productionUpdated", handleProductionUpdate);

    socket.on("productionDeleted", handleProductionUpdate);

    return () => {
      socket.off("productionCreated", handleProductionUpdate);

      socket.off("productionUpdated", handleProductionUpdate);

      socket.off("productionDeleted", handleProductionUpdate);
    };
  }, []);

  // ============================================================
  // LOAD ACTIVE FLOCK
  // ============================================================

  const loadActiveFlock = async (pen) => {
    setActiveFlock(null);
    setFlockError("");

    if (!pen) {
      setFlockLoading(false);
      return;
    }

    // Brooding House does not require a flock.
    if (pen === BROODING_HOUSE) {
      setFlockLoading(false);
      return;
    }

    setFlockLoading(true);

    try {
      const flock = await fetchActiveFlockByPen(pen);

      setActiveFlock(flock || null);
    } catch (error) {
      console.error("ACTIVE FLOCK ERROR:", error);

      setActiveFlock(null);

      setFlockError(
        error.response?.data?.message ||
          `Failed to load active flock for ${pen}.`,
      );
    } finally {
      setFlockLoading(false);
    }
  };

  // ============================================================
  // PEN CHANGE
  // ============================================================

  const handlePenChange = async (e) => {
    const pen = e.target.value;

    setFormData((prev) => ({
      ...prev,
      pen,

      ...(pen === BROODING_HOUSE
        ? {
            cratesProduced: "",
            extraEggPieces: "",
            miscarriageProduction: "",
            crackedEggs: "",
          }
        : {}),
    }));

    await loadActiveFlock(pen);
  };

  // ============================================================
  // GENERIC INPUT CHANGE
  // ============================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const calculatedClosingStock =
      Number(formData.openingStock || 0) +
      Number(formData.transferIn || 0) -
      Number(formData.transferOut || 0) -
      Number(formData.mortality || 0);

    if (calculatedClosingStock < 0) {
      toast.error(
        "Closing stock cannot be negative. Check opening stock, transfers, and mortality.",
      );

      return;
    }

    // ==========================================================
    // IMPORTANT:
    //
    // We deliberately DO NOT send:
    //
    // flock
    // flockId
    // flockAgeWeeks
    //
    // The backend determines those values from the active flock
    // for the selected pen.
    // ==========================================================

    const payload = {
      ...formData,

      days: Number(formData.days || 0),

      openingStock: Number(formData.openingStock || 0),

      transferIn: Number(formData.transferIn || 0),

      transferOut: Number(formData.transferOut || 0),

      mortality: Number(formData.mortality || 0),

      sickBirds: Number(formData.sickBirds || 0),

      // Decimal values are preserved.
      // Examples: 0.5, 1.25, 2.5
      feedBagsConsumed: Number(formData.feedBagsConsumed || 0),

      waterConsumed: Number(formData.waterConsumed || 0),

      // Brooding House has no egg production fields.
      cratesProduced: broodingHouse ? 0 : Number(formData.cratesProduced || 0),

      extraEggPieces: broodingHouse ? 0 : Number(formData.extraEggPieces || 0),

      miscarriageProduction: broodingHouse
        ? 0
        : Number(formData.miscarriageProduction || 0),

      crackedEggs: broodingHouse ? 0 : Number(formData.crackedEggs || 0),
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

      setFormData(emptyFormData);

      setActiveFlock(null);
      setFlockError("");
      setFlockLoading(false);

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

    await loadActiveFlock(record.pen);

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
  };

  // ============================================================
  // DELETE
  // ============================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this production record?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProduction(id);

      setProductions((prev) =>
        role === "superadmin"
          ? prev.filter((item) => item._id !== id)
          : prev.map((item) =>
              item._id === id
                ? {
                    ...item,
                    isDeleted: true,
                  }
                : item,
            ),
      );

      toast.success("Production record deleted successfully");

      await loadProductions(false);
    } catch (error) {
      console.error("DELETE PRODUCTION ERROR:", error);

      toast.error(
        error.response?.data?.message || "Failed to delete production record",
      );
    }
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredProductions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return productions;
    }

    return productions.filter((record) => {
      const values = [
        record?.pen,
        record?.flockId,
        record?.flock?.flockId,
        record?.flockAgeWeeks,
        record?.date,
        record?.remarks,
        record?.drugsUsed,
      ];

      return values.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(query),
      );
    });
  }, [productions, search]);

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

    // Closing stock is a DAILY BALANCE, not a value to be summed.
    // For the Brooding House, the latest active record represents
    // the current number of birds remaining.
    const broodingHouseRecords = activeRecords
      .filter((item) => item.pen === BROODING_HOUSE)
      .sort((a, b) => {
        const dateDifference =
          new Date(b.date).getTime() - new Date(a.date).getTime();

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });

    const latestBroodingHouseRecord = broodingHouseRecords[0] || null;

    const currentBroodingHouseStock = latestBroodingHouseRecord
      ? Number(latestBroodingHouseRecord.closingStock || 0)
      : 0;

    const currentBroodingHouseStockDate =
      latestBroodingHouseRecord?.date || null;

    return {
      records: activeRecords.length,
      totalEggs,
      totalMortality,
      totalFeed,
      currentBroodingHouseStock,
      currentBroodingHouseStockDate,
    };
  }, [productions]);

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

      "Feed Bags": record.feedBagsConsumed ?? 0,

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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Production");

    XLSX.writeFile(workbook, "production-records.xlsx");

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

    doc.text("Production Records", 14, 15);

    doc.setFontSize(9);

    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 21);

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
      startY: 26,

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

    doc.save("production-records.pdf");

    toast.success("Production records exported to PDF");
  };

  // ============================================================
  // FORM FIELD STYLES
  // ============================================================

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Poultry Production
          </h1>

          <p className="text-sm text-gray-500">
            Record daily production, stock movement, mortality and flock
            performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadProductions(true)}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Excel
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            PDF
          </button>
        </div>
      </div>

      {/* ======================================================
          STATISTICS
      ====================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Records</p>
          <p className="mt-1 text-2xl font-bold">{stats.records}</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Eggs</p>
          <p className="mt-1 text-2xl font-bold">
            {stats.totalEggs.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Mortality</p>
          <p className="mt-1 text-2xl font-bold">
            {stats.totalMortality.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Feed Bags</p>
          <p className="mt-1 text-2xl font-bold">
            {stats.totalFeed.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Brooding House Current Stock</p>

          <p className="mt-1 text-2xl font-bold">
            {stats.currentBroodingHouseStock.toLocaleString()}
          </p>

          {stats.currentBroodingHouseStockDate && (
            <p className="mt-1 text-xs text-gray-500">
              As of{" "}
              {new Date(
                stats.currentBroodingHouseStockDate,
              ).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* ======================================================
          PRODUCTION FORM
      ====================================================== */}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {editingId ? "Edit Production Record" : "Add Production Record"}
            </h2>

            {editingId && (
              <p className="mt-1 text-sm text-blue-600">
                You are editing an existing production record.
              </p>
            )}
          </div>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <h3 className="mb-3 font-semibold text-gray-800">
                Active Flock Information
              </h3>

              {flockLoading ? (
                <p className="text-sm text-gray-600">Loading active flock...</p>
              ) : flockError ? (
                <p className="text-sm text-red-600">{flockError}</p>
              ) : activeFlock ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">Flock ID</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.flockId}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Pen</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.pen}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Current Age</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.currentAgeWeeks ?? "—"}{" "}
                      {activeFlock.currentAgeWeeks !== undefined ? "weeks" : ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Lifecycle</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.lifecycleStatus || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Starting Age</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.startingAgeWeeks ?? "—"} weeks
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Placement Date</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.placementDate
                        ? new Date(
                            activeFlock.placementDate,
                          ).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Weeks Remaining</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.weeksRemaining ?? "—"} weeks
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">Expected End of Lay</p>
                    <p className="font-semibold text-gray-800">
                      {activeFlock.expectedEndOfLay
                        ? new Date(
                            activeFlock.expectedEndOfLay,
                          ).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
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
              Date
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
              required
              className={inputClass}
            />
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

          {/* MORTALITY */}

          <div>
            <label htmlFor="mortality" className={labelClass}>
              Mortality
            </label>

            <input
              id="mortality"
              type="number"
              min="0"
              name="mortality"
              value={formData.mortality}
              onChange={handleChange}
              className={inputClass}
            />
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

          {/* ==================================================
              FEED
              DECIMALS ARE ALLOWED
          ================================================== */}

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

          {/* CLOSING STOCK PREVIEW */}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Calculated Closing Stock</p>

            <p className="mt-1 text-xl font-bold text-gray-800">
              {Math.max(
                0,
                Number(formData.openingStock || 0) +
                  Number(formData.transferIn || 0) -
                  Number(formData.transferOut || 0) -
                  Number(formData.mortality || 0),
              ).toLocaleString()}
            </p>
          </div>

          {/* TOTAL EGGS PREVIEW */}

          {!broodingHouse && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Calculated Total Eggs</p>

              <p className="mt-1 text-xl font-bold text-gray-800">
                {(
                  Number(formData.cratesProduced || 0) * 30 +
                  Number(formData.extraEggPieces || 0)
                ).toLocaleString()}
              </p>
            </div>
          )}

          {/* PRODUCTION PERCENTAGE */}

          {!broodingHouse && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Production Percentage</p>

              <p className="mt-1 text-xl font-bold text-gray-800">
                {(() => {
                  const closingStock =
                    Number(formData.openingStock || 0) +
                    Number(formData.transferIn || 0) -
                    Number(formData.transferOut || 0) -
                    Number(formData.mortality || 0);

                  const totalEggs =
                    Number(formData.cratesProduced || 0) * 30 +
                    Number(formData.extraEggPieces || 0);

                  return closingStock > 0
                    ? `${((totalEggs / closingStock) * 100).toFixed(2)}%`
                    : "0%";
                })()}
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

          <div className="flex flex-wrap gap-3 md:col-span-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-lg border border-gray-300 px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ======================================================
          PRODUCTION LIST
      ====================================================== */}

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Production Records
            </h2>

            <p className="text-sm text-gray-500">
              Flock information shown here is the information saved with each
              production record.
            </p>
          </div>

          <div className="w-full md:w-80">
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

        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>

                <th className="px-4 py-3 font-semibold">Pen</th>

                <th className="px-4 py-3 font-semibold">Flock ID</th>

                <th className="px-4 py-3 font-semibold">Flock Age</th>

                <th className="px-4 py-3 font-semibold">Days</th>

                <th className="px-4 py-3 font-semibold">Opening</th>

                <th className="px-4 py-3 font-semibold">Transfer In</th>

                <th className="px-4 py-3 font-semibold">Transfer Out</th>

                <th className="px-4 py-3 font-semibold">Mortality</th>

                <th className="px-4 py-3 font-semibold">Closing</th>

                <th className="px-4 py-3 font-semibold">Sick</th>

                <th className="px-4 py-3 font-semibold">Feed</th>

                <th className="px-4 py-3 font-semibold">Water</th>

                <th className="px-4 py-3 font-semibold">Crates</th>

                <th className="px-4 py-3 font-semibold">Extra Eggs</th>

                <th className="px-4 py-3 font-semibold">Total Eggs</th>

                <th className="px-4 py-3 font-semibold">Production %</th>

                <th className="px-4 py-3 font-semibold">Miscarriage</th>

                <th className="px-4 py-3 font-semibold">Cracked</th>

                <th className="px-4 py-3 font-semibold">Status</th>

                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan="21"
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    Loading production records...
                  </td>
                </tr>
              ) : paginatedProductions.length === 0 ? (
                <tr>
                  <td
                    colSpan="21"
                    className="px-4 py-10 text-center text-gray-500"
                  >
                    No production records found.
                  </td>
                </tr>
              ) : (
                paginatedProductions.map((record) => (
                  <tr
                    key={record._id}
                    className={
                      record.isDeleted ? "bg-red-50" : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.date
                        ? new Date(record.date).toLocaleDateString()
                        : "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {record.pen || "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.flockId || record.flock?.flockId || "—"}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.flockAgeWeeks !== null &&
                      record.flockAgeWeeks !== undefined
                        ? `${record.flockAgeWeeks} weeks`
                        : "—"}
                    </td>

                    <td className="px-4 py-3">{record.days ?? 0}</td>

                    <td className="px-4 py-3">
                      {Number(record.openingStock || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.transferIn || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.transferOut || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.mortality || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {Number(record.closingStock || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.sickBirds || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.feedBagsConsumed || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.waterConsumed || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.cratesProduced || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.extraEggPieces || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 font-semibold">
                      {Number(record.totalEggs || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.productionPercentage || 0).toFixed(2)}%
                    </td>

                    <td className="px-4 py-3">
                      {Number(
                        record.miscarriageProduction || 0,
                      ).toLocaleString()}
                    </td>

                    <td className="px-4 py-3">
                      {Number(record.crackedEggs || 0).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {record.isDeleted ? (
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                          Deleted
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
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
                            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(record._id)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
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
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
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
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="px-2 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Production;
