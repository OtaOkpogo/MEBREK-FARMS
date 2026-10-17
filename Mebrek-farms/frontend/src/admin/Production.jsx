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
const DAY_MS = 24 * 60 * 60 * 1000;

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

const isBroodingHouse = (pen) => pen === BROODING_HOUSE;

const getCalendarDay = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match)
      return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
  )
    return "";
  return (
    startingAgeWeeks * 7 + Math.floor((productionDay - placementDay) / DAY_MS)
  );
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Report view only filters existing records; it never creates or merges records.
  const [reportView, setReportView] = useState("All Pens");

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
  // PEN CHANGE
  // ============================================================

  const handlePenChange = async (e) => {
    const pen = e.target.value;

    setFormData((prev) => ({
      ...prev,
      pen,
      days: "",

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

  const BATTERY_CAGE_PENS = [
    "Battery Cage Row 1",
    "Battery Cage Row 2",
    "Battery Cage Row 3",
  ];

  const isCombinedBatteryReport = reportView === "Battery Cage Combined";

  const filteredProductions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return productions.filter((record) => {
      const recordDay = getCalendarDay(record?.date);
      const fromDay = dateFrom ? getCalendarDay(dateFrom) : null;
      const toDay = dateTo ? getCalendarDay(dateTo) : null;
      if (fromDay !== null && (recordDay === null || recordDay < fromDay))
        return false;
      if (toDay !== null && (recordDay === null || recordDay > toDay))
        return false;
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

    // Closing stock is a point-in-time balance, not a daily value to sum.
    // For every pen, use only its latest active production record.
    const currentStockByPen = PENS.map((pen) => {
      const latestRecord =
        activeRecords
          .filter((item) => item.pen === pen)
          .sort((a, b) => {
            const dateDifference =
              new Date(b.date).getTime() - new Date(a.date).getTime();

            if (dateDifference !== 0) {
              return dateDifference;
            }

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

  // Combined battery-cage report. Egg/mortality/feed totals are summed from
  // the existing active records. Closing stock is taken from each row's latest
  // record, because stock is a balance and must not be summed across dates.
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

    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Records");

    if (isCombinedBatteryReport) {
      const summaryRows = [
        { Metric: "Total Eggs", Combined: batteryCombinedSummary.eggs },
        { Metric: "Crates Produced", Combined: batteryCombinedSummary.crates },
        { Metric: "Mortality", Combined: batteryCombinedSummary.mortality },
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
        { Metric: "Transfers In", Combined: batteryCombinedSummary.transferIn },
        {
          Metric: "Transfers Out",
          Combined: batteryCombinedSummary.transferOut,
        },
        { Metric: "Sick Birds", Combined: batteryCombinedSummary.sickBirds },
        { Metric: "Water Consumed", Combined: batteryCombinedSummary.water },
        { Metric: "Cracked Eggs", Combined: batteryCombinedSummary.cracked },
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
          PRODUCTION REPORT VIEW
      ====================================================== */}

      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
        <label
          htmlFor="productionReportView"
          className="mb-2 block text-sm font-semibold text-gray-800"
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
          className={`${inputClass} w-full bg-white md:max-w-xl`}
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
          <p className="mt-2 text-sm text-blue-800">
            Combined report selected: Battery Cage Rows 1, 2 and 3. The original
            individual production records are preserved.
          </p>
        )}
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
      </div>

      {/* ======================================================
          CURRENT STOCK BY PEN
      ====================================================== */}

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Current Stock by Pen
          </h2>

          <p className="text-sm text-gray-500">
            Shows the latest closing stock recorded for each pen.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stats.currentStockByPen.map((item) => (
            <div
              key={item.pen}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-medium text-gray-500">
                {item.pen} Current Stock
              </p>

              {item.hasRecord ? (
                <>
                  <p className="mt-1 text-2xl font-bold text-gray-800">
                    {item.currentStock.toLocaleString()}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    As of {new Date(item.date).toLocaleDateString("en-US")}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm font-medium text-gray-400">
                  No production record yet
                </p>
              )}
            </div>
          ))}
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
              readOnly={Boolean(activeFlock) && !broodingHouse}
              required
              className={`${inputClass} ${activeFlock && !broodingHouse ? "cursor-not-allowed bg-gray-100" : ""}`}
            />
            <p className="mt-1 text-xs text-gray-500">
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

          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <div className="flex flex-wrap gap-2">
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
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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

        {isCombinedBatteryReport && (
          <div className="space-y-4 border-b bg-blue-50/50 p-5">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                Battery Cage Combined Summary
              </h3>
              <p className="text-sm text-gray-600">
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
                <div key={label} className="rounded-lg border bg-white p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 text-xl font-bold text-gray-800">
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-gray-100 text-left">
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
                      <th key={heading} className="px-3 py-2 font-semibold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batteryCombinedSummary.rows.map((row) => (
                    <tr key={row.pen}>
                      <td className="px-3 py-2 font-medium">{row.pen}</td>
                      <td className="px-3 py-2">{row.records}</td>
                      <td className="px-3 py-2">{row.eggs.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {row.crates.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {row.mortality.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{row.feed.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {row.hasStock ? row.closingStock.toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.cracked.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              *Opening stock shows the first recorded opening stock per row in
              the current result set. Current birds sums each row's latest
              closing stock. Production % is a weighted estimate using recorded
              opening-stock values and should be interpreted as an overall
              indicator for the selected records.
            </p>
          </div>
        )}

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
