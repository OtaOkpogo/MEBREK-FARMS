import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Download,
  FileSpreadsheet,
  HeartPulse,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  RotateCcw,
  Edit,
  X,
} from "lucide-react";

import { PENS } from "../constants/pens";
import {
  fetchBirdHealth,
  createBirdHealth,
  updateBirdHealth,
  deleteBirdHealth,
  restoreBirdHealth,
} from "../services/birdHealthService";
import { fetchProductions } from "../services/productionService";
import { fetchMortality } from "../services/mortalityService";
import socket from "../services/socket";

// ==================================================
// CONSTANTS
// ==================================================

const CATEGORIES = [
  "Respiratory",
  "Digestive",
  "Parasitic",
  "Bacterial",
  "Viral",
  "Nutritional Deficiency",
  "Injury",
  "Other",
  "Vaccination",
  "Medication",
  "Mortality",
];

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

const HEALTH_STATUSES = [
  "Under Treatment",
  "Active",
  "Recovering",
  "Recovered",
  "Isolated",
  "Dead",
];

const FOLLOW_UP_STATUSES = ["Upcoming", "Due Today", "Overdue", "Completed"];

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  pen: PENS?.[0] || "",
  healthIssue: "",
  category: "Other",
  birdsAffected: 1,
  symptoms: "",
  severity: "Medium",
  vetConsulted: false,
  diagnosis: "",
  actionTaken: "",
  medicationUsed: "",
  veterinarianName: "",
  followUpDate: "",
  followUpStatus: "Upcoming",
  costOfTreatment: 0,
  currency: "NGN",
  status: "Under Treatment",
  remarks: "",
};

// ==================================================
// HELPERS
// ==================================================

const getApiRecords = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.records)) return response.records;
  if (Array.isArray(response?.data?.records)) return response.data.records;
  return null;
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const toDateInput = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString();
};

const formatNumber = (value) => Number(value ?? 0).toLocaleString();

const getFollowUpStatus = (record) => {
  if (record?.followUpStatus) return record.followUpStatus;

  if (!record?.followUpDate) return "Not scheduled";

  if (["Recovered", "Dead"].includes(record?.status)) {
    return "Completed";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(record.followUpDate);
  due.setHours(0, 0, 0, 0);

  if (due.getTime() < today.getTime()) return "Overdue";
  if (due.getTime() === today.getTime()) return "Due Today";

  return "Upcoming";
};

const badgeClass = (value) => {
  const classes = {
    Low: "bg-green-100 text-green-800",
    Medium: "bg-yellow-100 text-yellow-800",
    High: "bg-orange-100 text-orange-800",
    Critical: "bg-red-100 text-red-800",
    Active: "bg-blue-100 text-blue-800",
    "Under Treatment": "bg-orange-100 text-orange-800",
    Recovering: "bg-purple-100 text-purple-800",
    Recovered: "bg-green-100 text-green-800",
    Isolated: "bg-amber-100 text-amber-800",
    Dead: "bg-red-100 text-red-800",
    Upcoming: "bg-blue-100 text-blue-800",
    "Due Today": "bg-yellow-100 text-yellow-800",
    Overdue: "bg-red-100 text-red-800",
    Completed: "bg-green-100 text-green-800",
    "Not scheduled": "bg-gray-100 text-gray-700",
  };

  return classes[value] || "bg-gray-100 text-gray-700";
};

const isSuperadmin = (role) =>
  String(role || "").toLowerCase() === "superadmin";

// Accept the pen field used by the mortality tracker.
// birdBatch is the primary field in the current mortality service.
const getMortalityPen = (record) => {
  const value =
    record?.birdBatch ??
    record?.pen ??
    record?.penName ??
    record?.roomName ??
    "";

  if (typeof value === "string") return value.trim();

  if (value && typeof value === "object") {
    return String(
      value.name ?? value.pen ?? value.birdBatch ?? value.roomName ?? "",
    ).trim();
  }

  return "";
};

const getMortalityDeaths = (record) => {
  const value = Number(
    record?.numberDead ?? record?.mortality ?? record?.deaths ?? 0,
  );

  return Number.isFinite(value) && value > 0 ? value : 0;
};

// ==================================================
// COMPONENT
// ==================================================

export default function BirdHealth() {
  const role = localStorage.getItem("role") || "staff";
  const canRestore = isSuperadmin(role);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Production records supply sick-bird reports.
  const [productionRecords, setProductionRecords] = useState([]);
  const [productionLoading, setProductionLoading] = useState(false);

  // Mortality records come directly from GET /mortality.
  const [mortalityRecords, setMortalityRecords] = useState([]);
  const [mortalityLoading, setMortalityLoading] = useState(false);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Clinical filters.
  const [search, setSearch] = useState("");
  const [selectedPen, setSelectedPen] = useState("All");
  const [selectedSeverity, setSelectedSeverity] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFollowUp, setSelectedFollowUp] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Production report filters.
  const [productionPen, setProductionPen] = useState("All");
  const [productionDateFrom, setProductionDateFrom] = useState("");
  const [productionDateTo, setProductionDateTo] = useState("");
  const [showAllProductionReports, setShowAllProductionReports] =
    useState(true);

  // ==================================================
  // LOAD CLINICAL HEALTH RECORDS
  // ==================================================

  const loadRecords = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await fetchBirdHealth();
      const data = getApiRecords(response);

      if (!data) {
        console.error("Unexpected Bird Health API response:", response);
        toast.error("The Bird Health response was not in the expected format.");
        return;
      }

      setRecords(data);
    } catch (error) {
      console.error("FAILED TO LOAD BIRD HEALTH:", error);
      toast.error(
        getErrorMessage(error, "Failed to load Bird Health records."),
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // ==================================================
  // LOAD PRODUCTION RECORDS
  // ==================================================

  const loadSickBirdReports = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setProductionLoading(true);

      const response = await fetchProductions();
      const data = getApiRecords(response);

      if (!data) {
        console.error("Unexpected Production API response:", response);
        toast.error("Production records could not be read.");
        return;
      }

      setProductionRecords(data.filter((production) => !production.isDeleted));
    } catch (error) {
      console.error("FAILED TO LOAD PRODUCTION REPORTS:", error);
      toast.error(getErrorMessage(error, "Failed to load production reports."));
    } finally {
      if (showLoader) setProductionLoading(false);
    }
  }, []);

  // ==================================================
  // LOAD ACTUAL MORTALITY TRACKING RECORDS
  // ==================================================

  const loadMortalityReports = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setMortalityLoading(true);

      const response = await fetchMortality();
      const data = getApiRecords(response);

      if (!data) {
        console.error("Unexpected Mortality API response:", response);
        toast.error("Mortality records could not be read.");
        return;
      }

      // Ignore soft-deleted entries, if the API returns them.
      const activeRecords = data.filter((record) => !record.isDeleted);

      setMortalityRecords(activeRecords);

      console.log("MORTALITY TRACKING RECORDS:", activeRecords);
      console.log(
        "TOTAL MORTALITY FROM TRACKING:",
        activeRecords.reduce(
          (total, record) => total + getMortalityDeaths(record),
          0,
        ),
      );
    } catch (error) {
      console.error("FAILED TO LOAD MORTALITY TRACKING:", error);
      toast.error(
        getErrorMessage(error, "Failed to load Mortality tracking records."),
      );
    } finally {
      if (showLoader) setMortalityLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    loadRecords(false);
    loadSickBirdReports(false);
    loadMortalityReports(false);
  }, [loadRecords, loadSickBirdReports, loadMortalityReports]);

  // ==================================================
  // SOCKET.IO REFRESH
  // ==================================================

  useEffect(() => {
    loadRecords();
    loadSickBirdReports();
    loadMortalityReports();

    if (!socket) return undefined;

    const refreshClinical = () => loadRecords(false);
    const refreshProduction = () => loadSickBirdReports(false);
    const refreshMortality = () => loadMortalityReports(false);

    socket.on("birdHealthCreated", refreshClinical);
    socket.on("birdHealthUpdated", refreshClinical);
    socket.on("birdHealthDeleted", refreshClinical);
    socket.on("birdHealthRestored", refreshClinical);

    socket.on("newProduction", refreshProduction);
    socket.on("productionUpdated", refreshProduction);
    socket.on("productionDeleted", refreshProduction);

    // These listeners refresh the UI if the backend emits these events.
    socket.on("mortalityCreated", refreshMortality);
    socket.on("mortalityUpdated", refreshMortality);
    socket.on("mortalityDeleted", refreshMortality);
    socket.on("newMortality", refreshMortality);

    return () => {
      socket.off("birdHealthCreated", refreshClinical);
      socket.off("birdHealthUpdated", refreshClinical);
      socket.off("birdHealthDeleted", refreshClinical);
      socket.off("birdHealthRestored", refreshClinical);

      socket.off("newProduction", refreshProduction);
      socket.off("productionUpdated", refreshProduction);
      socket.off("productionDeleted", refreshProduction);

      socket.off("mortalityCreated", refreshMortality);
      socket.off("mortalityUpdated", refreshMortality);
      socket.off("mortalityDeleted", refreshMortality);
      socket.off("newMortality", refreshMortality);
    };
  }, [loadRecords, loadSickBirdReports, loadMortalityReports]);

  // ==================================================
  // CLINICAL FORM
  // ==================================================

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        type === "checkbox"
          ? checked
          : ["birdsAffected", "costOfTreatment"].includes(name)
            ? value === ""
              ? ""
              : Number(value)
            : value,
    }));
  };

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.date || !formData.pen || !formData.healthIssue.trim()) {
      toast.error("Date, pen, and health issue are required.");
      return;
    }

    if (Number(formData.birdsAffected) < 0) {
      toast.error("Birds affected cannot be negative.");
      return;
    }

    const payload = {
      ...formData,
      date: formData.date,
      healthIssue: formData.healthIssue.trim(),
      birdsAffected: Number(formData.birdsAffected || 0),
      costOfTreatment: Number(formData.costOfTreatment || 0),
      followUpDate: formData.followUpDate || null,
      symptoms: formData.symptoms.trim(),
      diagnosis: formData.diagnosis.trim(),
      actionTaken: formData.actionTaken.trim(),
      medicationUsed: formData.medicationUsed.trim(),
      veterinarianName: formData.veterinarianName.trim(),
      remarks: formData.remarks.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        await updateBirdHealth(editingId, payload);
        toast.success("Bird Health record updated successfully.");
      } else {
        await createBirdHealth(payload);
        toast.success("Bird Health record created successfully.");
      }

      resetForm();
      await loadRecords(false);
    } catch (error) {
      console.error("FAILED TO SAVE BIRD HEALTH:", error);
      toast.error(getErrorMessage(error, "Failed to save Bird Health record."));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record._id);

    setFormData({
      ...EMPTY_FORM,
      ...record,
      date: toDateInput(record.date),
      followUpDate: toDateInput(record.followUpDate),
      birdsAffected: Number(record.birdsAffected || 0),
      costOfTreatment: Number(record.costOfTreatment || 0),
      vetConsulted: Boolean(record.vetConsulted),
      category: record.category || "Other",
      severity: record.severity || "Medium",
      status: record.status || "Under Treatment",
    });

    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (record) => {
    if (
      !window.confirm(
        `Delete the Bird Health record for "${record.healthIssue}" in ${record.pen}?`,
      )
    ) {
      return;
    }

    try {
      await deleteBirdHealth(record._id);
      toast.success("Bird Health record deleted.");
      await loadRecords(false);
    } catch (error) {
      console.error("FAILED TO DELETE BIRD HEALTH:", error);
      toast.error(getErrorMessage(error, "Failed to delete the record."));
    }
  };

  const handleRestore = async (record) => {
    if (!canRestore) {
      toast.error("Only a superadmin can restore deleted records.");
      return;
    }

    try {
      await restoreBirdHealth(record._id);
      toast.success("Bird Health record restored.");
      await loadRecords(false);
    } catch (error) {
      console.error("FAILED TO RESTORE BIRD HEALTH:", error);
      toast.error(getErrorMessage(error, "Failed to restore the record."));
    }
  };

  // ==================================================
  // FILTER CLINICAL RECORDS
  // ==================================================

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      if (record.isDeleted && !canRestore) return false;

      const searchable = [
        record.healthIssue,
        record.pen,
        record.symptoms,
        record.diagnosis,
        record.actionTaken,
        record.medicationUsed,
        record.veterinarianName,
        record.remarks,
        record.recordedByName,
      ];

      const matchesSearch =
        !query ||
        searchable
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesPen = selectedPen === "All" || record.pen === selectedPen;

      const matchesSeverity =
        selectedSeverity === "All" || record.severity === selectedSeverity;

      const matchesStatus =
        selectedStatus === "All" || record.status === selectedStatus;

      const matchesCategory =
        selectedCategory === "All" || record.category === selectedCategory;

      const matchesFollowUp =
        selectedFollowUp === "All" ||
        getFollowUpStatus(record) === selectedFollowUp;

      const recordDate = toDateInput(record.date);

      return (
        matchesSearch &&
        matchesPen &&
        matchesSeverity &&
        matchesStatus &&
        matchesCategory &&
        matchesFollowUp &&
        (!dateFrom || recordDate >= dateFrom) &&
        (!dateTo || recordDate <= dateTo)
      );
    });
  }, [
    records,
    canRestore,
    search,
    selectedPen,
    selectedSeverity,
    selectedStatus,
    selectedCategory,
    selectedFollowUp,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedPen,
    selectedSeverity,
    selectedStatus,
    selectedCategory,
    selectedFollowUp,
    dateFrom,
    dateTo,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  const paginatedRecords = filteredRecords.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ==================================================
  // PRODUCTION REPORT CALCULATIONS
  // ==================================================

  // Latest production record per pen, including zero-value records.
  const latestProductionByPen = useMemo(() => {
    const latest = new Map();

    const sorted = [...productionRecords].sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    );

    for (const production of sorted) {
      if (!production.pen || latest.has(production.pen)) continue;
      latest.set(production.pen, production);
    }

    return latest;
  }, [productionRecords]);

  const latestPenReports = useMemo(
    () =>
      [...latestProductionByPen.values()].sort((a, b) =>
        String(a.pen).localeCompare(String(b.pen)),
      ),
    [latestProductionByPen],
  );

  const currentSickBirdPenReports = useMemo(
    () =>
      latestPenReports.filter(
        (production) => Number(production.sickBirds ?? 0) > 0,
      ),
    [latestPenReports],
  );

  const currentSickBirdTotal = useMemo(
    () =>
      latestPenReports.reduce(
        (total, production) => total + Number(production.sickBirds ?? 0),
        0,
      ),
    [latestPenReports],
  );

  // This is the latest-production mortality figure, not historical tracking.
  const currentProductionMortalityTotal = useMemo(
    () =>
      latestPenReports.reduce(
        (total, production) => total + Number(production.mortality ?? 0),
        0,
      ),
    [latestPenReports],
  );

  // Historical production records with sick birds or mortality.
  const historicalSickBirdReports = useMemo(() => {
    return productionRecords
      .filter(
        (production) =>
          Number(production.sickBirds ?? 0) > 0 ||
          Number(production.mortality ?? 0) > 0,
      )
      .filter((production) => {
        const matchesPen =
          productionPen === "All" || production.pen === productionPen;

        const productionDate = toDateInput(production.date);

        return (
          matchesPen &&
          (!productionDateFrom || productionDate >= productionDateFrom) &&
          (!productionDateTo || productionDate <= productionDateTo)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
      );
  }, [productionRecords, productionPen, productionDateFrom, productionDateTo]);

  const visibleProductionReports = useMemo(() => {
    if (showAllProductionReports) return historicalSickBirdReports;

    return historicalSickBirdReports.filter((production) => {
      const latest = latestProductionByPen.get(production.pen);

      return (
        latest &&
        String(latest._id) === String(production._id) &&
        (Number(latest.sickBirds ?? 0) > 0 || Number(latest.mortality ?? 0) > 0)
      );
    });
  }, [
    historicalSickBirdReports,
    showAllProductionReports,
    latestProductionByPen,
  ]);

  // ==================================================
  // MORTALITY TRACKING CALCULATIONS
  // ==================================================

  // Group actual Mortality tracking records by pen.
  // The primary fields are birdBatch and numberDead.
  const mortalityByPen = useMemo(() => {
    const grouped = new Map();

    for (const record of mortalityRecords) {
      const pen = getMortalityPen(record);

      if (!pen) continue;

      const deaths = getMortalityDeaths(record);

      const item = grouped.get(pen) || {
        pen,
        totalDeaths: 0,
        entries: 0,
        latestDate: null,
      };

      item.totalDeaths += deaths;
      item.entries += 1;

      const recordDate = record.date ? new Date(record.date) : null;

      if (
        recordDate &&
        !Number.isNaN(recordDate.getTime()) &&
        (!item.latestDate || recordDate > item.latestDate)
      ) {
        item.latestDate = recordDate;
      }

      grouped.set(pen, item);
    }

    return [...grouped.values()].sort((a, b) => a.pen.localeCompare(b.pen));
  }, [mortalityRecords]);

  // All deaths returned by Mortality tracking, not the latest Production row.
  const totalTrackedMortality = useMemo(
    () =>
      mortalityRecords.reduce(
        (total, record) => total + getMortalityDeaths(record),
        0,
      ),
    [mortalityRecords],
  );

  const pensWithRecordedMortality = useMemo(
    () => mortalityByPen.filter((item) => item.totalDeaths > 0).length,
    [mortalityByPen],
  );

  // Use the same date and pen filters as the Production report section.
  const filteredMortalityRecords = useMemo(
    () =>
      mortalityRecords
        .filter((record) => {
          const pen = getMortalityPen(record);
          const recordDate = toDateInput(record.date);

          return (
            (productionPen === "All" || pen === productionPen) &&
            (!productionDateFrom || recordDate >= productionDateFrom) &&
            (!productionDateTo || recordDate <= productionDateTo)
          );
        })
        .sort(
          (a, b) =>
            new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
        ),
    [mortalityRecords, productionPen, productionDateFrom, productionDateTo],
  );

  const filteredMortalityTotal = useMemo(
    () =>
      filteredMortalityRecords.reduce(
        (total, record) => total + getMortalityDeaths(record),
        0,
      ),
    [filteredMortalityRecords],
  );

  // ==================================================
  // CLINICAL SUMMARY STATISTICS
  // ==================================================

  const clinicalStats = useMemo(() => {
    const activeRecords = records.filter((record) => !record.isDeleted);

    return {
      total: activeRecords.length,
      underTreatment: activeRecords.filter((record) =>
        ["Under Treatment", "Active"].includes(record.status),
      ).length,
      critical: activeRecords.filter(
        (record) =>
          record.severity === "Critical" && record.status !== "Recovered",
      ).length,
      recovering: activeRecords.filter(
        (record) => record.status === "Recovering",
      ).length,
      followUpsDue: activeRecords.filter((record) =>
        ["Due Today", "Overdue"].includes(getFollowUpStatus(record)),
      ).length,
    };
  }, [records]);

  // ==================================================
  // EXPORTS
  // ==================================================

  const exportClinicalExcel = () => {
    const rows = filteredRecords.map((record) => ({
      Date: formatDate(record.date),
      Pen: record.pen || "",
      "Health Issue": record.healthIssue || "",
      Category: record.category || "",
      "Birds Affected": Number(record.birdsAffected || 0),
      Severity: record.severity || "",
      Symptoms: record.symptoms || "",
      Diagnosis: record.diagnosis || "",
      Treatment: record.actionTaken || "",
      Medication: record.medicationUsed || "",
      Veterinarian: record.veterinarianName || "",
      "Follow-up Date": formatDate(record.followUpDate),
      "Follow-up Status": getFollowUpStatus(record),
      Status: record.status || "",
      "Treatment Cost": Number(record.costOfTreatment || 0),
      Remarks: record.remarks || "",
      Deleted: record.isDeleted ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Bird Health");
    XLSX.writeFile(workbook, "Mebrek_Bird_Health.xlsx");
  };

  const exportProductionExcel = () => {
    const rows = visibleProductionReports.map((production) => ({
      Date: formatDate(production.date),
      Pen: production.pen || "",
      "Sick Birds": Number(production.sickBirds ?? 0),
      "Production Mortality": Number(production.mortality ?? 0),
      "Flock ID": production.flockId || "",
      "Flock Age (Weeks)": production.flockAgeWeeks ?? "",
      Remarks: production.remarks || "",
      "Report Type":
        String(latestProductionByPen.get(production.pen)?._id) ===
        String(production._id)
          ? "Latest production record"
          : "Historical production record",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Production Health Reports",
    );

    XLSX.writeFile(workbook, "Mebrek_Production_Health_Reports.xlsx");
  };

  const exportMortalityExcel = () => {
    const rows = filteredMortalityRecords.map((record) => ({
      Date: formatDate(record.date),
      Pen: getMortalityPen(record),
      "Number Dead": getMortalityDeaths(record),
      Cause: record.cause || "",
      Notes: record.notes || record.remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Mortality Tracking");

    XLSX.writeFile(workbook, "Mebrek_Mortality_Tracking.xlsx");
  };

  const exportClinicalPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Mebrek Farms - Bird Health Records", 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [
        [
          "Date",
          "Pen",
          "Health Issue",
          "Affected",
          "Severity",
          "Diagnosis",
          "Treatment",
          "Follow-up",
          "Status",
        ],
      ],
      body: filteredRecords.map((record) => [
        formatDate(record.date),
        record.pen || "",
        record.healthIssue || "",
        Number(record.birdsAffected || 0),
        record.severity || "",
        record.diagnosis || "",
        record.actionTaken || "",
        `${formatDate(record.followUpDate)} (${getFollowUpStatus(record)})`,
        record.status || "",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [22, 101, 52] },
    });

    doc.save("Mebrek_Bird_Health.pdf");
  };

  const exportProductionPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Mebrek Farms - Production Health Reports", 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [
        [
          "Date",
          "Pen",
          "Sick Birds",
          "Production Mortality",
          "Flock ID",
          "Flock Age",
          "Remarks",
        ],
      ],
      body: visibleProductionReports.map((production) => [
        formatDate(production.date),
        production.pen || "",
        Number(production.sickBirds ?? 0),
        Number(production.mortality ?? 0),
        production.flockId || "—",
        production.flockAgeWeeks ?? "—",
        production.remarks || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [22, 101, 52] },
    });

    doc.save("Mebrek_Production_Health_Reports.pdf");
  };

  const exportMortalityPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text("Mebrek Farms - Mortality Tracking", 14, 15);
    doc.setFontSize(10);
    doc.text(
      `Total deaths in filtered records: ${formatNumber(filteredMortalityTotal)}`,
      14,
      21,
    );

    autoTable(doc, {
      startY: 27,
      head: [["Date", "Pen", "Number Dead", "Cause", "Notes"]],
      body: filteredMortalityRecords.map((record) => [
        formatDate(record.date),
        getMortalityPen(record),
        getMortalityDeaths(record),
        record.cause || "—",
        record.notes || record.remarks || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [153, 27, 27] },
    });

    doc.save("Mebrek_Mortality_Tracking.pdf");
  };

  const printPage = () => window.print();

  // ==================================================
  // REUSABLE STYLES
  // ==================================================

  const inputClass =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100";

  const labelClass = "mb-1 block text-sm font-medium text-gray-700";

  const buttonClass =
    "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60";

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <HeartPulse className="text-green-700" size={28} />
            Bird Health Management
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            Track clinical health records, sick birds, mortality, treatments,
            and follow-ups across all pens.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          >
            <RefreshCw size={16} />
            Refresh All
          </button>

          <button
            type="button"
            onClick={exportClinicalExcel}
            className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
          >
            <FileSpreadsheet size={16} />
            Health Excel
          </button>

          <button
            type="button"
            onClick={exportClinicalPDF}
            className={`${buttonClass} bg-red-600 text-white hover:bg-red-700`}
          >
            <Download size={16} />
            Health PDF
          </button>

          <button
            type="button"
            onClick={printPage}
            className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* CLINICAL SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Health Records",
            value: clinicalStats.total,
            Icon: ClipboardList,
            color: "text-blue-600",
          },
          {
            label: "Active Cases",
            value: clinicalStats.underTreatment,
            Icon: Activity,
            color: "text-orange-600",
          },
          {
            label: "Critical Cases",
            value: clinicalStats.critical,
            Icon: AlertTriangle,
            color: "text-red-600",
          },
          {
            label: "Recovering",
            value: clinicalStats.recovering,
            Icon: HeartPulse,
            color: "text-purple-600",
          },
          {
            label: "Follow-ups Due",
            value: clinicalStats.followUpsDue,
            Icon: CalendarDays,
            color: "text-amber-600",
          },
        ].map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{label}</p>
              <Icon className={color} size={22} />
            </div>

            <p className="mt-2 text-2xl font-bold text-gray-900">
              {formatNumber(value)}
            </p>
          </div>
        ))}
      </div>

      {/* ==================================================
          MORTALITY TRACKING
      ================================================== */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <AlertTriangle className="text-red-700" size={22} />
              Mortality Tracking Summary
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              Actual deaths from the Mortality tracking module, grouped by pen.
              These totals are separate from Production mortality.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadMortalityReports()}
              disabled={mortalityLoading}
              className={`${buttonClass} bg-red-700 text-white hover:bg-red-800`}
            >
              <RefreshCw
                size={16}
                className={mortalityLoading ? "animate-spin" : ""}
              />
              {mortalityLoading ? "Loading..." : "Refresh Mortality"}
            </button>

            <button
              type="button"
              onClick={exportMortalityExcel}
              className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              <FileSpreadsheet size={16} />
              Excel
            </button>

            <button
              type="button"
              onClick={exportMortalityPDF}
              className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              <Download size={16} />
              PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-red-100 bg-red-50 p-4">
            <p className="text-sm text-red-700">Total Recorded Deaths</p>
            <p className="mt-1 text-3xl font-bold text-red-800">
              {formatNumber(totalTrackedMortality)}
            </p>
            <p className="mt-1 text-xs text-red-700">
              Sum of numberDead in Mortality tracking
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Pens with Mortality</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {formatNumber(pensWithRecordedMortality)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">Filtered Mortality Total</p>
            <p className="mt-1 text-3xl font-bold text-red-700">
              {formatNumber(filteredMortalityTotal)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Uses the pen and date filters in the reports section below
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-semibold text-gray-800">
            Total Mortality by Pen
          </h3>

          {mortalityLoading && mortalityRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Loading mortality records...
            </p>
          ) : mortalityByPen.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No mortality records were returned by the API. Check the browser
              console if you expected records here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Pen",
                      "Total Deaths",
                      "Mortality Entries",
                      "Latest Recorded Date",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {mortalityByPen.map((item) => (
                    <tr key={item.pen}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {item.pen}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
                          {formatNumber(item.totalDeaths)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        {formatNumber(item.entries)}
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        {item.latestDate ? formatDate(item.latestDate) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-bold text-gray-900">Total</td>

                    <td className="px-4 py-3 font-bold text-red-800">
                      {formatNumber(totalTrackedMortality)}
                    </td>

                    <td className="px-4 py-3 font-bold text-gray-900">
                      {formatNumber(
                        mortalityByPen.reduce(
                          (total, item) => total + item.entries,
                          0,
                        ),
                      )}
                    </td>

                    <td className="px-4 py-3">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 font-semibold text-gray-800">
            Individual Mortality Records
          </h3>

          {filteredMortalityRecords.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No mortality records match the selected pen and dates.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Date", "Pen", "Number Dead", "Cause", "Notes"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left font-semibold text-gray-600"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredMortalityRecords.map((record) => (
                    <tr
                      key={
                        record._id ||
                        `${getMortalityPen(record)}-${record.date}-${getMortalityDeaths(record)}`
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {formatDate(record.date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {getMortalityPen(record) || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-800">
                          {formatNumber(getMortalityDeaths(record))}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        {record.cause || "—"}
                      </td>

                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        {record.notes || record.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          PRODUCTION SICK-BIRD REPORTS
      ================================================== */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <Stethoscope className="text-green-700" size={22} />
              Sick Birds and Mortality from Production
            </h2>

            <p className="mt-1 text-sm text-gray-600">
              These figures come from daily Production records. Production
              mortality is shown separately from Mortality tracking totals.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSickBirdReports()}
            disabled={productionLoading}
            className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
          >
            <RefreshCw
              size={16}
              className={productionLoading ? "animate-spin" : ""}
            />
            {productionLoading ? "Loading..." : "Refresh Production Reports"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Pens with Current Sick Birds
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(currentSickBirdPenReports.length)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Current Sick-Bird Count</p>
            <p className="mt-1 text-2xl font-bold text-orange-700">
              {formatNumber(currentSickBirdTotal)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              Current Production Mortality
            </p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {formatNumber(currentProductionMortalityTotal)}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Historical Health Reports</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(historicalSickBirdReports.length)}
            </p>
          </div>
        </div>

        {/* LATEST PRODUCTION RECORD BY PEN */}
        <div>
          <h3 className="mb-3 font-semibold text-gray-800">
            Latest Production Record by Pen
          </h3>

          {productionLoading && productionRecords.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Loading production records...
            </p>
          ) : latestPenReports.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No production records were found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Pen",
                      "Latest Date",
                      "Sick Birds",
                      "Production Mortality",
                      "Flock",
                      "Flock Age",
                      "Remarks",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {latestPenReports.map((production) => {
                    const sickBirds = Number(production.sickBirds ?? 0);
                    const mortality = Number(production.mortality ?? 0);

                    return (
                      <tr
                        key={
                          production._id ||
                          `${production.pen}-${production.date}`
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                          {production.pen || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {formatDate(production.date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              sickBirds > 0
                                ? "bg-orange-100 text-orange-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {formatNumber(sickBirds)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              mortality > 0
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {formatNumber(mortality)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {production.flockId || "—"}
                        </td>

                        <td className="px-4 py-3 text-gray-600">
                          {production.flockAgeWeeks != null
                            ? `${production.flockAgeWeeks} weeks`
                            : "—"}
                        </td>

                        <td className="max-w-xs px-4 py-3 text-gray-600">
                          {production.remarks || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* HISTORICAL PRODUCTION REPORTS */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="font-semibold text-gray-800">
              Historical Production Health Reports
            </h3>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowAllProductionReports(true)}
                className={`${buttonClass} ${
                  showAllProductionReports
                    ? "bg-green-700 text-white"
                    : "border border-gray-300 bg-white text-gray-700"
                }`}
              >
                All Reports
              </button>

              <button
                type="button"
                onClick={() => setShowAllProductionReports(false)}
                className={`${buttonClass} ${
                  !showAllProductionReports
                    ? "bg-green-700 text-white"
                    : "border border-gray-300 bg-white text-gray-700"
                }`}
              >
                Latest Positive Only
              </button>

              <button
                type="button"
                onClick={exportProductionExcel}
                className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
              >
                <FileSpreadsheet size={16} />
                Excel
              </button>

              <button
                type="button"
                onClick={exportProductionPDF}
                className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
              >
                <Download size={16} />
                PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Filter by pen</label>
              <select
                value={productionPen}
                onChange={(event) => setProductionPen(event.target.value)}
                className={inputClass}
              >
                <option value="All">All pens</option>
                {PENS.map((pen) => (
                  <option key={pen} value={pen}>
                    {pen}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>From date</label>
              <input
                type="date"
                value={productionDateFrom}
                onChange={(event) => setProductionDateFrom(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>To date</label>
              <input
                type="date"
                value={productionDateTo}
                onChange={(event) => setProductionDateTo(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {visibleProductionReports.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              No production health reports match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Date",
                      "Pen",
                      "Sick Birds",
                      "Production Mortality",
                      "Flock ID",
                      "Flock Age",
                      "Remarks",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-3 text-left font-semibold text-gray-600"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 bg-white">
                  {visibleProductionReports.map((production) => (
                    <tr
                      key={
                        production._id || `${production.pen}-${production.date}`
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                        {formatDate(production.date)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                        {production.pen || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-800">
                          {formatNumber(production.sickBirds)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                          {formatNumber(production.mortality)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {production.flockId || "—"}
                      </td>

                      <td className="px-4 py-3 text-gray-600">
                        {production.flockAgeWeeks != null
                          ? `${production.flockAgeWeeks} weeks`
                          : "—"}
                      </td>

                      <td className="max-w-xs px-4 py-3 text-gray-600">
                        {production.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ==================================================
          CLINICAL HEALTH RECORDS
      ================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Clinical Health Records
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Record symptoms, diagnoses, treatment, medication, and follow-ups.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setFormData({ ...EMPTY_FORM });
                setEditingId(null);
                setShowForm(true);
              }
            }}
            className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close Form" : "Add Health Record"}
          </button>
        </div>

        {/* CLINICAL FORM */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                {editingId ? "Edit Health Record" : "New Health Record"}
              </h3>

              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close form"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass}>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Pen *</label>
                <select
                  name="pen"
                  value={formData.pen}
                  onChange={handleChange}
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

              <div>
                <label className={labelClass}>Health Issue *</label>
                <input
                  type="text"
                  name="healthIssue"
                  value={formData.healthIssue}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Coughing, diarrhoea"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Birds Affected</label>
                <input
                  type="number"
                  name="birdsAffected"
                  min="0"
                  value={formData.birdsAffected}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Severity</label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>
                      {severity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Health Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {HEALTH_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Follow-up Date</label>
                <input
                  type="date"
                  name="followUpDate"
                  value={formData.followUpDate}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Treatment Cost (₦)</label>
                <input
                  type="number"
                  name="costOfTreatment"
                  min="0"
                  value={formData.costOfTreatment}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Veterinarian</label>
                <input
                  type="text"
                  name="veterinarianName"
                  value={formData.veterinarianName}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Veterinarian's name"
                />
              </div>

              <div>
                <label className={labelClass}>Medication Used</label>
                <input
                  type="text"
                  name="medicationUsed"
                  value={formData.medicationUsed}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Medication or drug"
                />
              </div>

              <div className="flex items-center gap-2 self-end pb-2">
                <input
                  id="vetConsulted"
                  type="checkbox"
                  name="vetConsulted"
                  checked={Boolean(formData.vetConsulted)}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-green-700"
                />

                <label
                  htmlFor="vetConsulted"
                  className="text-sm font-medium text-gray-700"
                >
                  Veterinarian consulted
                </label>
              </div>

              {[
                {
                  name: "symptoms",
                  label: "Symptoms",
                  placeholder: "Describe observed symptoms",
                },
                {
                  name: "diagnosis",
                  label: "Diagnosis",
                  placeholder: "Diagnosis or suspected cause",
                },
                {
                  name: "actionTaken",
                  label: "Action Taken / Treatment",
                  placeholder: "Treatment, isolation, or other action",
                },
                {
                  name: "remarks",
                  label: "Remarks",
                  placeholder: "Additional notes",
                },
              ].map(({ name, label, placeholder }) => (
                <div key={name} className="sm:col-span-2 lg:col-span-3">
                  <label className={labelClass}>{label}</label>
                  <textarea
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    rows={2}
                    className={inputClass}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className={`${buttonClass} bg-green-700 px-5 text-white hover:bg-green-800`}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Record"
                    : "Save Record"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* CLINICAL FILTERS */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
            <Search size={18} />
            Filter Clinical Records
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelClass}>Search</label>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Issue, symptoms, diagnosis..."
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Pen</label>
              <select
                value={selectedPen}
                onChange={(event) => setSelectedPen(event.target.value)}
                className={inputClass}
              >
                <option value="All">All pens</option>
                {PENS.map((pen) => (
                  <option key={pen} value={pen}>
                    {pen}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Severity</label>
              <select
                value={selectedSeverity}
                onChange={(event) => setSelectedSeverity(event.target.value)}
                className={inputClass}
              >
                <option value="All">All severities</option>
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Health Status</label>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className={inputClass}
              >
                <option value="All">All statuses</option>
                {HEALTH_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Category</label>
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className={inputClass}
              >
                <option value="All">All categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Follow-up Status</label>
              <select
                value={selectedFollowUp}
                onChange={(event) => setSelectedFollowUp(event.target.value)}
                className={inputClass}
              >
                <option value="All">All follow-up statuses</option>
                {FOLLOW_UP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
                <option value="Not scheduled">Not scheduled</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-500">
              Showing {formatNumber(filteredRecords.length)} matching record(s)
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedPen("All");
                setSelectedSeverity("All");
                setSelectedStatus("All");
                setSelectedCategory("All");
                setSelectedFollowUp("All");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-sm font-medium text-green-700 hover:text-green-900"
            >
              Clear filters
            </button>
          </div>
        </div>

        {/* CLINICAL RECORDS TABLE */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-900">Bird Health Records</h3>

            <p className="text-sm text-gray-500">
              {loading
                ? "Loading records..."
                : `${filteredRecords.length} record(s)`}
            </p>
          </div>

          {loading && records.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              Loading Bird Health records...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle className="mx-auto mb-3 text-gray-300" size={36} />
              <p className="font-medium text-gray-700">
                No Bird Health records found
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Change your filters or add a new clinical health record.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Date / Pen",
                        "Health Issue",
                        "Affected",
                        "Severity",
                        "Diagnosis / Treatment",
                        "Follow-up",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left font-semibold text-gray-600"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 bg-white">
                    {paginatedRecords.map((record) => (
                      <tr
                        key={record._id}
                        className={
                          record.isDeleted ? "bg-red-50/50" : "hover:bg-gray-50"
                        }
                      >
                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <div className="font-medium text-gray-900">
                            {formatDate(record.date)}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {record.pen || "—"}
                          </div>

                          {record.isDeleted && (
                            <span className="mt-1 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                              Deleted
                            </span>
                          )}
                        </td>

                        <td className="min-w-48 px-4 py-3 align-top">
                          <div className="font-medium text-gray-900">
                            {record.healthIssue || "—"}
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {record.category || "Other"}
                          </div>

                          {record.symptoms && (
                            <p className="mt-2 max-w-xs whitespace-pre-wrap text-xs text-gray-600">
                              {record.symptoms}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 align-top font-semibold text-gray-900">
                          {formatNumber(record.birdsAffected)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(record.severity)}`}
                          >
                            {record.severity || "—"}
                          </span>
                        </td>

                        <td className="min-w-52 px-4 py-3 align-top">
                          <p className="font-medium text-gray-800">
                            {record.diagnosis || "No diagnosis entered"}
                          </p>

                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
                            {record.actionTaken || "No treatment entered"}
                          </p>

                          {record.medicationUsed && (
                            <p className="mt-1 text-xs text-gray-500">
                              Medication: {record.medicationUsed}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <p className="text-gray-800">
                            {formatDate(record.followUpDate)}
                          </p>

                          <span
                            className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass(getFollowUpStatus(record))}`}
                          >
                            {getFollowUpStatus(record)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(record.status)}`}
                          >
                            {record.status || "—"}
                          </span>

                          {record.vetConsulted && (
                            <p className="mt-1 text-xs text-green-700">
                              Vet consulted
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            {!record.isDeleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEdit(record)}
                                  title="Edit record"
                                  className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit size={16} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDelete(record)}
                                  title="Delete record"
                                  className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}

                            {record.isDeleted && canRestore && (
                              <button
                                type="button"
                                onClick={() => handleRestore(record)}
                                title="Restore record"
                                className="rounded-lg p-2 text-green-700 hover:bg-green-50"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex flex-col gap-3 border-t border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((current) => Math.min(totalPages, current + 1))
                    }
                    className={`${buttonClass} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
