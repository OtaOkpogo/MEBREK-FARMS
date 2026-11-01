import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { PENS } from "../constants/pens";

import {
  fetchVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  restoreVaccination,
} from "../services/vaccinationService";

import socket from "../services/socket";

const getStoredRole = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    const rawRole = storedUser?.role || localStorage.getItem("role") || "";

    return String(rawRole)
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  } catch {
    return String(localStorage.getItem("role") || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }
};

const VACCINE_TYPES = [
  "Newcastle Disease (ND)",
  "Gumboro (IBD)",
  "Fowl Pox",
  "Marek's Disease",
  "Infectious Bronchitis (IB)",
  "Fowl Cholera",
  "Avian Influenza",
  "Coryza",
  "Salmonella",
  "Coccidiosis",
  "Vitamin Supplement",
  "Deworming",
  "Other",
];

const ROUTES = ["Drinking Water", "Injection", "Spray", "Eye Drop"];
const UNITS = ["Dose", "Bottle", "Vial"];

const STATUS_OPTIONS = ["Upcoming", "Due Today", "Overdue", "Completed"];

const STATUS_COLORS = {
  Upcoming: "bg-blue-50 text-blue-700 border-blue-100",
  "Due Today": "bg-amber-50 text-amber-700 border-amber-100",
  Overdue: "bg-red-50 text-red-700 border-red-100",
  Completed: "bg-green-50 text-green-700 border-green-100",
};

const PAGE_SIZE = 10;

const EMPTY_FORM = {
  pen: "",
  vaccineName: "",
  vaccineType: "",
  batchNumber: "",
  manufacturer: "",
  quantityUsed: "",
  unit: "Dose",
  birdsVaccinated: "",
  vaccinationDate: "",
  nextDueDate: "",
  route: "",
  cost: "",
  notes: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100";

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

const formatDateForInput = (date) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatCurrency = (amount) => {
  const value = Number(amount);

  if (!Number.isFinite(value)) return "₦0.00";

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(value);
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const extractVaccinations = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.vaccinations)) return response.vaccinations;
  if (Array.isArray(response?.data?.vaccinations)) {
    return response.data.vaccinations;
  }
  if (Array.isArray(response?.data)) return response.data;

  return [];
};

const validateForm = (data) => {
  if (!data.pen) {
    return "Please select a pen.";
  }

  if (!data.vaccineName.trim()) {
    return "Vaccine name is required.";
  }

  if (!data.vaccineType) {
    return "Please select a vaccine type.";
  }

  if (!data.vaccinationDate) {
    return "Vaccination date is required.";
  }

  if (!data.route) {
    return "Please select the administration route.";
  }

  const quantity = Number(data.quantityUsed);
  const birds = Number(data.birdsVaccinated);
  const cost = Number(data.cost || 0);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantity used must be greater than zero.";
  }

  if (!Number.isInteger(birds) || birds <= 0) {
    return "Birds vaccinated must be a whole number greater than zero.";
  }

  if (!Number.isFinite(cost) || cost < 0) {
    return "Cost cannot be negative.";
  }

  const vaccinationDate = new Date(`${data.vaccinationDate}T00:00:00`);

  if (Number.isNaN(vaccinationDate.getTime())) {
    return "Please enter a valid vaccination date.";
  }

  if (data.nextDueDate) {
    const nextDueDate = new Date(`${data.nextDueDate}T00:00:00`);

    if (Number.isNaN(nextDueDate.getTime())) {
      return "Please enter a valid next due date.";
    }

    if (nextDueDate < vaccinationDate) {
      return "Next due date cannot be earlier than the vaccination date.";
    }
  }

  return "";
};

const preparePayload = (data) => ({
  ...data,
  vaccineName: data.vaccineName.trim(),
  batchNumber: data.batchNumber.trim(),
  manufacturer: data.manufacturer.trim(),
  quantityUsed: Number(data.quantityUsed),
  birdsVaccinated: Number(data.birdsVaccinated),
  cost: Number(data.cost || 0),
  notes: data.notes.trim(),
});

const mergeRecord = (records, incoming) => {
  if (!incoming?._id) return records;

  const exists = records.some(
    (item) => String(item._id) === String(incoming._id),
  );

  if (exists) {
    return records.map((item) =>
      String(item._id) === String(incoming._id) ? incoming : item,
    );
  }

  return [incoming, ...records];
};

// ============================================================
// REUSABLE FORM FIELDS
// ============================================================

function VaccinationFormFields({ data, onChange, prefix = "" }) {
  const fieldId = (name) => `${prefix}${name}`;

  return (
    <>
      <div>
        <label htmlFor={fieldId("pen")} className={labelClass}>
          Pen
        </label>

        <select
          id={fieldId("pen")}
          name="pen"
          value={data.pen}
          onChange={onChange}
          className={inputClass}
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
        <label htmlFor={fieldId("vaccineName")} className={labelClass}>
          Vaccine Name
        </label>

        <input
          id={fieldId("vaccineName")}
          type="text"
          name="vaccineName"
          placeholder="e.g. Newcastle Vaccine"
          value={data.vaccineName}
          onChange={onChange}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor={fieldId("vaccineType")} className={labelClass}>
          Vaccine Type
        </label>

        <select
          id={fieldId("vaccineType")}
          name="vaccineType"
          value={data.vaccineType}
          onChange={onChange}
          className={inputClass}
          required
        >
          <option value="">Select Vaccine Type</option>

          {VACCINE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={fieldId("batchNumber")} className={labelClass}>
          Batch Number
        </label>

        <input
          id={fieldId("batchNumber")}
          type="text"
          name="batchNumber"
          placeholder="Batch number"
          value={data.batchNumber}
          onChange={onChange}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={fieldId("manufacturer")} className={labelClass}>
          Manufacturer
        </label>

        <input
          id={fieldId("manufacturer")}
          type="text"
          name="manufacturer"
          placeholder="Manufacturer"
          value={data.manufacturer}
          onChange={onChange}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={fieldId("quantityUsed")} className={labelClass}>
          Quantity Used
        </label>

        <input
          id={fieldId("quantityUsed")}
          type="number"
          name="quantityUsed"
          min="0.01"
          step="any"
          placeholder="Quantity used"
          value={data.quantityUsed}
          onChange={onChange}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor={fieldId("unit")} className={labelClass}>
          Unit
        </label>

        <select
          id={fieldId("unit")}
          name="unit"
          value={data.unit}
          onChange={onChange}
          className={inputClass}
        >
          {UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={fieldId("birdsVaccinated")} className={labelClass}>
          Birds Vaccinated
        </label>

        <input
          id={fieldId("birdsVaccinated")}
          type="number"
          name="birdsVaccinated"
          min="1"
          step="1"
          placeholder="Number of birds"
          value={data.birdsVaccinated}
          onChange={onChange}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor={fieldId("vaccinationDate")} className={labelClass}>
          Vaccination Date
        </label>

        <input
          id={fieldId("vaccinationDate")}
          type="date"
          name="vaccinationDate"
          value={data.vaccinationDate}
          onChange={onChange}
          className={inputClass}
          required
        />
      </div>

      <div>
        <label htmlFor={fieldId("nextDueDate")} className={labelClass}>
          Next Due Date
        </label>

        <input
          id={fieldId("nextDueDate")}
          type="date"
          name="nextDueDate"
          value={data.nextDueDate}
          onChange={onChange}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor={fieldId("route")} className={labelClass}>
          Administration Route
        </label>

        <select
          id={fieldId("route")}
          name="route"
          value={data.route}
          onChange={onChange}
          className={inputClass}
          required
        >
          <option value="">Select Route</option>

          {ROUTES.map((route) => (
            <option key={route} value={route}>
              {route}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={fieldId("cost")} className={labelClass}>
          Cost (₦)
        </label>

        <input
          id={fieldId("cost")}
          type="number"
          name="cost"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={data.cost}
          onChange={onChange}
          className={inputClass}
        />
      </div>

      <div className="md:col-span-3">
        <label htmlFor={fieldId("notes")} className={labelClass}>
          Notes
        </label>

        <textarea
          id={fieldId("notes")}
          name="notes"
          placeholder="Additional notes about this vaccination..."
          value={data.notes}
          onChange={onChange}
          rows={3}
          className={inputClass}
        />
      </div>
    </>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Vaccinations() {
  const [role] = useState(getStoredRole);

  const canEdit = ["manager", "superadmin"].includes(role);
  const isSuperAdmin = role === "superadmin";

  const [vaccinations, setVaccinations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [exporting, setExporting] = useState("");

  const [search, setSearch] = useState("");
  const [penFilter, setPenFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState(EMPTY_FORM);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState(EMPTY_FORM);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // ============================================================
  // LOAD VACCINATIONS
  // ============================================================

  const loadVaccinations = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await fetchVaccinations();

      setVaccinations(extractVaccinations(response));

      if (!showLoader) {
        toast.success("Vaccination records refreshed.");
      }
    } catch (error) {
      console.error("LOAD VACCINATIONS ERROR:", error);

      toast.error(
        getErrorMessage(error, "Failed to load vaccination records."),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVaccinations();
  }, [loadVaccinations]);

  // ============================================================
  // SOCKET.IO LIVE UPDATES
  // ============================================================

  useEffect(() => {
    const handleNewVaccination = (record) => {
      if (!record?._id) return;

      setVaccinations((previous) => mergeRecord(previous, record));

      toast.success(
        `New vaccination record added for ${record.pen || "a pen"}.`,
      );
    };

    const handleVaccinationUpdated = (updated) => {
      if (!updated?._id) return;

      setVaccinations((previous) => mergeRecord(previous, updated));

      toast.info(`${updated.vaccineName || "Vaccination"} record updated.`);
    };

    const handleVaccinationDeleted = (deleted) => {
      if (!deleted?._id) return;

      if (isSuperAdmin) {
        setVaccinations((previous) =>
          previous.map((item) =>
            String(item._id) === String(deleted._id) ? deleted : item,
          ),
        );
      } else {
        setVaccinations((previous) =>
          previous.filter((item) => String(item._id) !== String(deleted._id)),
        );
      }

      toast.warning("A vaccination record was deleted.");
    };

    const handleVaccinationRestored = (restored) => {
      if (!restored?._id) return;

      setVaccinations((previous) => mergeRecord(previous, restored));

      toast.success(
        `${restored.vaccineName || "Vaccination"} record restored.`,
      );
    };

    socket.on("newVaccination", handleNewVaccination);
    socket.on("vaccinationUpdated", handleVaccinationUpdated);
    socket.on("vaccinationDeleted", handleVaccinationDeleted);
    socket.on("vaccinationRestored", handleVaccinationRestored);

    return () => {
      socket.off("newVaccination", handleNewVaccination);
      socket.off("vaccinationUpdated", handleVaccinationUpdated);
      socket.off("vaccinationDeleted", handleVaccinationDeleted);
      socket.off("vaccinationRestored", handleVaccinationRestored);
    };
  }, [isSuperAdmin]);

  // ============================================================
  // CREATE FORM
  // ============================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (creating) return;

    const validationError = validateForm(formData);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setCreating(true);

      await createVaccination(preparePayload(formData));

      toast.success("Vaccination record saved successfully.");

      setFormData(EMPTY_FORM);

      // Refresh ensures the table is updated even if a socket
      // event is missed or the connected client is temporarily offline.
      await loadVaccinations(false);
    } catch (error) {
      console.error("CREATE VACCINATION ERROR:", error);

      toast.error(getErrorMessage(error, "Failed to save vaccination record."));
    } finally {
      setCreating(false);
    }
  };

  // ============================================================
  // EDIT
  // ============================================================

  const openEditModal = (record) => {
    if (!canEdit || !record?._id || record.isDeleted) return;

    setEditingRecord(record);

    setEditData({
      pen: record.pen || "",
      vaccineName: record.vaccineName || "",
      vaccineType: record.vaccineType || "",
      batchNumber: record.batchNumber || "",
      manufacturer: record.manufacturer || "",
      quantityUsed: record.quantityUsed ?? "",
      unit: record.unit || "Dose",
      birdsVaccinated: record.birdsVaccinated ?? "",
      vaccinationDate: formatDateForInput(record.vaccinationDate),
      nextDueDate: formatDateForInput(record.nextDueDate),
      route: record.route || "",
      cost: record.cost ?? "",
      notes: record.notes || "",
    });

    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (updating) return;

    setEditingRecord(null);
    setEditData(EMPTY_FORM);
    setShowEditModal(false);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (updating || !editingRecord?._id) return;

    const validationError = validateForm(editData);

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setUpdating(true);

      await updateVaccination(editingRecord._id, preparePayload(editData));

      toast.success("Vaccination record updated.");

      setShowEditModal(false);
      setEditingRecord(null);
      setEditData(EMPTY_FORM);

      await loadVaccinations(false);
    } catch (error) {
      console.error("UPDATE VACCINATION ERROR:", error);

      toast.error(
        getErrorMessage(error, "Failed to update vaccination record."),
      );
    } finally {
      setUpdating(false);
    }
  };

  // ============================================================
  // DELETE
  // ============================================================

  const openDeleteModal = (record) => {
    if (!canEdit || !record?._id || record.isDeleted) return;

    setSelectedRecord(record);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;

    setSelectedRecord(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!selectedRecord?._id || deleting) return;

    try {
      setDeleting(true);

      await deleteVaccination(selectedRecord._id);

      toast.success("Vaccination record deleted.");

      setShowDeleteModal(false);
      setSelectedRecord(null);

      await loadVaccinations(false);
    } catch (error) {
      console.error("DELETE VACCINATION ERROR:", error);

      toast.error(
        getErrorMessage(error, "Failed to delete vaccination record."),
      );
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // RESTORE
  // ============================================================

  const handleRestore = async (record) => {
    if (!isSuperAdmin || !record?._id || restoringId) return;

    try {
      setRestoringId(record._id);

      await restoreVaccination(record._id);

      toast.success("Vaccination record restored.");

      await loadVaccinations(false);
    } catch (error) {
      console.error("RESTORE VACCINATION ERROR:", error);

      toast.error(
        getErrorMessage(error, "Failed to restore vaccination record."),
      );
    } finally {
      setRestoringId(null);
    }
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredVaccinations = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return vaccinations.filter((item) => {
      // Hide deleted records from non-superadmin users.
      if (item.isDeleted && !isSuperAdmin) return false;

      if (penFilter !== "All" && item.pen !== penFilter) {
        return false;
      }

      if (statusFilter !== "All" && item.status !== statusFilter) {
        return false;
      }

      if (!keyword) return true;

      const searchableValues = [
        item.pen,
        item.vaccineName,
        item.vaccineType,
        item.batchNumber,
        item.manufacturer,
        item.route,
        item.status,
        item.administeredBy?.name,
        item.deletedByName,
        item.notes,
        item.vaccinationDate ? formatDate(item.vaccinationDate) : "",
        item.nextDueDate ? formatDate(item.nextDueDate) : "",
      ];

      return searchableValues.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [vaccinations, search, penFilter, statusFilter, isSuperAdmin]);

  useEffect(() => {
    setPage(1);
  }, [search, penFilter, statusFilter]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const stats = useMemo(() => {
    const active = vaccinations.filter((item) => !item.isDeleted);

    const deletedCount = vaccinations.filter((item) => item.isDeleted).length;

    const now = new Date();

    const completedThisMonth = active.filter((item) => {
      if (item.status !== "Completed" || !item.vaccinationDate) {
        return false;
      }

      const date = new Date(item.vaccinationDate);

      return (
        !Number.isNaN(date.getTime()) &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      total: active.length,
      dueToday: active.filter((item) => item.status === "Due Today").length,
      upcoming: active.filter((item) => item.status === "Upcoming").length,
      overdue: active.filter((item) => item.status === "Overdue").length,
      completedThisMonth,
      deletedCount,
    };
  }, [vaccinations]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredVaccinations.length / PAGE_SIZE),
  );

  const paginatedVaccinations = filteredVaccinations.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ============================================================
  // EXPORT
  // ============================================================

  const exportColumns = [
    "Pen",
    "Vaccine",
    "Type",
    "Batch",
    "Manufacturer",
    "Qty",
    "Unit",
    "Birds Vaccinated",
    "Date",
    "Next Due",
    "Route",
    "Cost",
    "Status",
  ];

  const exportRows = () =>
    filteredVaccinations.map((item) => [
      item.pen || "-",
      item.vaccineName || "-",
      item.vaccineType || "-",
      item.batchNumber || "-",
      item.manufacturer || "-",
      item.quantityUsed ?? 0,
      item.unit || "-",
      item.birdsVaccinated ?? 0,
      formatDate(item.vaccinationDate),
      formatDate(item.nextDueDate),
      item.route || "-",
      item.cost ?? 0,
      item.isDeleted ? "Deleted" : item.status || "-",
    ]);

  const getExportFilename = (extension) =>
    `vaccination-records-${new Date().toISOString().slice(0, 10)}.${extension}`;

  const handleExportExcel = async () => {
    if (filteredVaccinations.length === 0) {
      toast.error("No vaccination records to export.");
      return;
    }

    if (exporting) return;

    try {
      setExporting("excel");

      const module = await import("xlsx");
      const XLSX = module.default || module;

      const worksheet = XLSX.utils.aoa_to_sheet([
        exportColumns,
        ...exportRows(),
      ]);

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Vaccinations");

      XLSX.writeFile(workbook, getExportFilename("xlsx"));

      toast.success("Excel export completed.");
    } catch (error) {
      console.error("EXCEL EXPORT ERROR:", error);
      toast.error("Failed to export Excel file.");
    } finally {
      setExporting("");
    }
  };

  const handleExportPDF = async () => {
    if (filteredVaccinations.length === 0) {
      toast.error("No vaccination records to export.");
      return;
    }

    if (exporting) return;

    try {
      setExporting("pdf");

      const [pdfModule, tableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const JsPDF = pdfModule.jsPDF || pdfModule.default;
      const autoTable = tableModule.default || tableModule.autoTable;

      const doc = new JsPDF({
        orientation: "landscape",
      });

      doc.setFontSize(16);
      doc.text("Mebrek Farms - Vaccination Records", 14, 15);

      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, 14, 21);

      autoTable(doc, {
        head: [exportColumns],
        body: exportRows(),
        startY: 27,
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [49, 95, 61],
        },
        alternateRowStyles: {
          fillColor: [246, 249, 244],
        },
      });

      doc.save(getExportFilename("pdf"));

      toast.success("PDF export completed.");
    } catch (error) {
      console.error("PDF EXPORT ERROR:", error);
      toast.error("Failed to export PDF file.");
    } finally {
      setExporting("");
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#f5f7f3]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#dce9d9] border-t-[#39784b]" />

          <p className="mt-4 text-sm font-medium text-gray-500">
            Loading vaccination records...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen space-y-6 bg-[#f5f7f3] p-4 md:p-6">
      {/* HEADER */}

      <section className={`${panelClass} p-5`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-[#eaf2e7] px-3 py-1 text-xs font-semibold tracking-wide text-[#315f3d]">
              FARM HEALTH MANAGEMENT
            </span>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#263b2b] md:text-3xl">
              Vaccination Management
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Record poultry vaccinations, monitor upcoming schedules and
              maintain your farm's vaccination history.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadVaccinations(false)}
            disabled={refreshing}
            className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh Records"}
          </button>
        </div>
      </section>

      {/* STATISTICS */}

      <section
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${
          isSuperAdmin ? "xl:grid-cols-6" : "xl:grid-cols-5"
        }`}
      >
        <div className="rounded-xl border border-[#e1eadf] bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            Total Vaccinations
          </p>

          <p className="mt-2 text-2xl font-bold text-[#315f3d]">
            {stats.total}
          </p>

          <p className="mt-1 text-xs text-gray-400">Active records</p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            Due Today
          </p>

          <p className="mt-2 text-2xl font-bold text-amber-600">
            {stats.dueToday}
          </p>

          <p className="mt-1 text-xs text-gray-400">Require attention today</p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            Upcoming
          </p>

          <p className="mt-2 text-2xl font-bold text-blue-600">
            {stats.upcoming}
          </p>

          <p className="mt-1 text-xs text-gray-400">Scheduled vaccinations</p>
        </div>

        <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            Overdue
          </p>

          <p className="mt-2 text-2xl font-bold text-red-600">
            {stats.overdue}
          </p>

          <p className="mt-1 text-xs text-gray-400">Past due date</p>
        </div>

        <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 sm:text-sm">
            Completed This Month
          </p>

          <p className="mt-2 text-2xl font-bold text-purple-600">
            {stats.completedThisMonth}
          </p>

          <p className="mt-1 text-xs text-gray-400">Completed records</p>
        </div>

        {isSuperAdmin && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500 sm:text-sm">
              Deleted Records
            </p>

            <p className="mt-2 text-2xl font-bold text-gray-600">
              {stats.deletedCount}
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Available for restoration
            </p>
          </div>
        )}
      </section>

      {/* CREATE FORM */}

      <section className={`${panelClass} overflow-hidden`}>
        <div className="border-b border-[#e8ede6] bg-[#fbfcfa] p-5">
          <h2 className="text-lg font-bold text-[#2c4331]">
            Add Vaccination Record
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Enter the vaccine details, number of birds treated and the next
            vaccination date where applicable.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <VaccinationFormFields data={formData} onChange={handleChange} />

          <div className="border-t border-gray-100 pt-4 md:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-[#39784b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {creating ? "Saving Record..." : "Save Vaccination Record"}
            </button>
          </div>
        </form>
      </section>

      {/* FILTERS AND EXPORT */}

      <section className={`${panelClass} p-5`}>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-[#2c4331]">
            Vaccination Records
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Filter, search and export your vaccination history.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="penFilter" className={labelClass}>
              Filter by Pen
            </label>

            <select
              id="penFilter"
              value={penFilter}
              onChange={(event) => setPenFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Pens</option>

              {PENS.map((pen) => (
                <option key={pen} value={pen}>
                  {pen}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="statusFilter" className={labelClass}>
              Filter by Status
            </label>

            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="All">All Statuses</option>

              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="vaccinationSearch" className={labelClass}>
              Search Records
            </label>

            <input
              id="vaccinationSearch"
              type="search"
              placeholder="Search pen, vaccine, batch, manufacturer or date..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={Boolean(exporting) || filteredVaccinations.length === 0}
            className="rounded-lg bg-[#39784b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "excel" ? "Preparing Excel..." : "Export Excel"}
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={Boolean(exporting) || filteredVaccinations.length === 0}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === "pdf" ? "Preparing PDF..." : "Export PDF"}
          </button>

          <button
            type="button"
            onClick={() => {
              setSearch("");
              setPenFilter("All");
              setStatusFilter("All");
            }}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </section>

      {/* RECORDS */}

      {filteredVaccinations.length === 0 ? (
        <section className={`${panelClass} p-12 text-center`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#edf4e9] text-3xl">
            💉
          </div>

          <h2 className="mt-4 text-xl font-bold text-[#2c4331]">
            No vaccination records found
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            {search || penFilter !== "All" || statusFilter !== "All"
              ? "Try adjusting your search or filters."
              : "Add your first vaccination record using the form above."}
          </p>
        </section>
      ) : (
        <>
          {/* DESKTOP TABLE */}

          <section className={`${panelClass} hidden overflow-hidden md:block`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1250px] text-sm">
                <thead className="bg-[#edf3e9] text-left text-[#38563d]">
                  <tr>
                    {[
                      "Pen",
                      "Vaccine",
                      "Type",
                      "Batch",
                      "Qty",
                      "Birds",
                      "Date",
                      "Next Due",
                      "Route",
                      "Status",
                      "By",
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
                  {paginatedVaccinations.map((item) => (
                    <tr
                      key={item._id}
                      className={`transition hover:bg-[#f7faf5] ${
                        item.isDeleted ? "bg-red-50/50" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-700">
                        {item.pen || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-800">
                        {item.vaccineName || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {item.vaccineType || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {item.batchNumber || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {item.quantityUsed ?? "—"} {item.unit || ""}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {item.birdsVaccinated ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {formatDate(item.vaccinationDate)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {formatDate(item.nextDueDate)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-gray-600">
                        {item.route || "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {item.isDeleted ? (
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            Deleted
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              STATUS_COLORS[item.status] ||
                              "border-gray-200 bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.status || "—"}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {item.isDeleted ? (
                          <div>
                            <p className="text-gray-600">
                              {item.deletedByName || "Unknown"}
                            </p>

                            <p className="text-xs text-gray-400">
                              {item.deletedByRole || ""}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-700">
                              {item.administeredBy?.name || "—"}
                            </p>

                            <p className="text-xs text-gray-400">
                              {item.administeredBy?.role || ""}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {item.isDeleted ? (
                          isSuperAdmin ? (
                            <button
                              type="button"
                              onClick={() => handleRestore(item)}
                              disabled={Boolean(restoringId)}
                              className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                            >
                              {restoringId === item._id
                                ? "Restoring..."
                                : "Restore"}
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )
                        ) : canEdit ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeleteModal(item)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* MOBILE CARDS */}

          <section className="space-y-3 md:hidden">
            {paginatedVaccinations.map((item) => (
              <article
                key={item._id}
                className={`rounded-xl border border-[#e5ebe3] bg-white p-4 shadow-sm ${
                  item.isDeleted ? "border-red-200 bg-red-50/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-bold text-gray-800">
                      {item.vaccineName || "Unnamed Vaccine"}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {item.pen || "—"}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      {item.vaccineType || ""}
                    </p>
                  </div>

                  {item.isDeleted ? (
                    <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                      Deleted
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                        STATUS_COLORS[item.status] ||
                        "border-gray-200 bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.status || "—"}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Vaccination Date</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {formatDate(item.vaccinationDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Next Due</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {formatDate(item.nextDueDate)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Quantity</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {item.quantityUsed ?? "—"} {item.unit || ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Birds Vaccinated</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {item.birdsVaccinated ?? "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Route</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {item.route || "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400">Batch Number</p>
                    <p className="mt-1 font-medium text-gray-700">
                      {item.batchNumber || "—"}
                    </p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Administered By</p>

                    <p className="mt-1 font-medium text-gray-700">
                      {item.isDeleted
                        ? item.deletedByName || "Unknown"
                        : item.administeredBy?.name || "—"}
                    </p>
                  </div>
                </div>

                {(canEdit || (isSuperAdmin && item.isDeleted)) && (
                  <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
                    {item.isDeleted ? (
                      isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRestore(item)}
                          disabled={Boolean(restoringId)}
                          className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-700 disabled:opacity-50"
                        >
                          {restoringId === item._id
                            ? "Restoring..."
                            : "Restore Record"}
                        </button>
                      )
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(item)}
                          className="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                )}
              </article>
            ))}
          </section>

          {/* PAGINATION */}

          <section className="flex flex-col gap-3 rounded-xl border border-[#e5ebe3] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing <strong>{(page - 1) * PAGE_SIZE + 1}</strong> to{" "}
              <strong>
                {Math.min(page * PAGE_SIZE, filteredVaccinations.length)}
              </strong>{" "}
              of <strong>{filteredVaccinations.length}</strong> records
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((previous) => previous - 1)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="rounded-lg bg-[#39784b] px-4 py-2 text-sm font-semibold text-white">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((previous) => previous + 1)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}

      {/* EDIT MODAL */}

      {showEditModal && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm">
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-[#e5ebe3] bg-white shadow-2xl">
            <div className="border-b border-[#e8ede6] bg-[#fbfcfa] p-5">
              <h2 className="text-xl font-bold text-[#2c4331]">
                Edit Vaccination Record
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Update the vaccination details below.
              </p>
            </div>

            <form
              onSubmit={handleUpdate}
              className="grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2 lg:grid-cols-3"
            >
              <VaccinationFormFields
                data={editData}
                onChange={handleEditChange}
                prefix="edit-"
              />

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 md:col-span-2 lg:col-span-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={updating}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-lg bg-[#39784b] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2d633d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#e5ebe3] bg-white p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
                ⚠️
              </div>

              <h2 className="mt-4 text-xl font-bold text-gray-800">
                Delete Vaccination Record?
              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Are you sure you want to delete this vaccination record?
              </p>

              <p className="mt-3 font-bold text-gray-800">
                {selectedRecord?.vaccineName} — {selectedRecord?.pen}
              </p>

              <p className="mt-2 text-xs text-gray-400">
                The record will be handled using your existing deletion and
                restoration process.
              </p>
            </div>

            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
