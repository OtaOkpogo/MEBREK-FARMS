import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PENS } from "../constants/pens";

import {
  fetchVaccinations,
  createVaccination,
  updateVaccination,
  deleteVaccination,
  restoreVaccination,
} from "../services/vaccinationService";
import socket from "../services/socket";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const role = user?.role || localStorage.getItem("role");

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
  Upcoming: "bg-blue-100 text-blue-700",
  "Due Today": "bg-yellow-100 text-yellow-700",
  Overdue: "bg-red-100 text-red-700",
  Completed: "bg-green-100 text-green-700",
};

const PAGE_SIZE = 10;

const emptyFormData = {
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

const canEdit = role === "manager" || role === "superadmin";

export default function Vaccinations() {
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [penFilter, setPenFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState(emptyFormData);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editData, setEditData] = useState(emptyFormData);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ==========================
  // LOAD VACCINATIONS
  // ==========================
  const loadVaccinations = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const data = await fetchVaccinations();
      setVaccinations(data);
      if (!showLoader) {
        toast.success("Vaccination records refreshed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load vaccination records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadVaccinations();
  }, []);

  // ==========================
  // SOCKET.IO LIVE UPDATES
  // ==========================
  useEffect(() => {
    const handleNewVaccination = (record) => {
      setVaccinations((prev) => [record, ...prev]);
      toast.success(`New vaccination record added for ${record.pen}`);
    };

    const handleVaccinationUpdated = (updated) => {
      setVaccinations((prev) =>
        prev.map((item) => (item._id === updated._id ? updated : item)),
      );
      toast.info(`${updated.vaccineName} record updated`);
    };

    const handleVaccinationDeleted = (deleted) => {
      if (role === "superadmin") {
        setVaccinations((prev) =>
          prev.map((item) => (item._id === deleted._id ? deleted : item)),
        );
      } else {
        setVaccinations((prev) =>
          prev.filter((item) => item._id !== deleted._id),
        );
      }
      toast.warning("A vaccination record was deleted");
    };

    const handleVaccinationRestored = (restored) => {
      setVaccinations((prev) =>
        prev.map((item) => (item._id === restored._id ? restored : item)),
      );
      toast.success(`${restored.vaccineName} record restored`);
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
  }, []);

  // ==========================
  // CREATE
  // ==========================
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createVaccination({
        ...formData,
        quantityUsed: Number(formData.quantityUsed),
        birdsVaccinated: Number(formData.birdsVaccinated),
        cost: Number(formData.cost || 0),
      });

      toast.success("Vaccination record saved successfully.");
      setFormData(emptyFormData);
      // Socket.IO ("newVaccination") will add it to the table automatically.
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error || "Failed to save vaccination record",
      );
    }
  };

  // ==========================
  // EDIT
  // ==========================
  const openEditModal = (record) => {
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
      vaccinationDate: record.vaccinationDate
        ? record.vaccinationDate.slice(0, 10)
        : "",
      nextDueDate: record.nextDueDate ? record.nextDueDate.slice(0, 10) : "",
      route: record.route || "",
      cost: record.cost ?? "",
      notes: record.notes || "",
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setShowEditModal(false);
  };

  const handleEditChange = (e) => {
    setEditData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateVaccination(editingRecord._id, {
        ...editData,
        quantityUsed: Number(editData.quantityUsed),
        birdsVaccinated: Number(editData.birdsVaccinated),
        cost: Number(editData.cost || 0),
      });

      toast.success("Vaccination record updated.");
      closeEditModal();
      // Socket.IO ("vaccinationUpdated") updates the table automatically.
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error || "Failed to update vaccination record",
      );
    }
  };

  // ==========================
  // DELETE / RESTORE
  // ==========================
  const openDeleteModal = (record) => {
    setSelectedRecord(record);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setSelectedRecord(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!selectedRecord) return;
    setDeleting(true);
    try {
      await deleteVaccination(selectedRecord._id);
      toast.success("Vaccination record deleted.");
      setShowDeleteModal(false);
      setSelectedRecord(null);
      // Socket.IO ("vaccinationDeleted") updates everyone automatically.
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete vaccination record");
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (record) => {
    try {
      await restoreVaccination(record._id);
      toast.success("Vaccination record restored.");
      // Socket.IO ("vaccinationRestored") updates the table automatically.
    } catch (err) {
      console.error(err);
      toast.error("Failed to restore vaccination record");
    }
  };

  // ==========================
  // FILTERING
  // ==========================
  const penFiltered =
    penFilter === "All"
      ? vaccinations
      : vaccinations.filter((item) => item.pen === penFilter);

  const statusFiltered =
    statusFilter === "All"
      ? penFiltered
      : penFiltered.filter((item) => item.status === statusFilter);

  const filteredVaccinations = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return statusFiltered;

    return statusFiltered.filter((item) => {
      const dateStr = item.vaccinationDate
        ? new Date(item.vaccinationDate).toLocaleDateString()
        : "";
      return (
        item.pen?.toLowerCase().includes(keyword) ||
        item.vaccineName?.toLowerCase().includes(keyword) ||
        item.batchNumber?.toLowerCase().includes(keyword) ||
        item.manufacturer?.toLowerCase().includes(keyword) ||
        dateStr.toLowerCase().includes(keyword)
      );
    });
  }, [statusFiltered, search]);

  useEffect(() => {
    setPage(1);
  }, [search, penFilter, statusFilter]);

  // ==========================
  // STATISTICS
  // ==========================
  const stats = useMemo(() => {
    const active = vaccinations.filter((v) => !v.isDeleted);
    const deletedCount = vaccinations.filter((v) => v.isDeleted).length;

    const now = new Date();

    const completedThisMonth = active.filter((v) => {
      if (v.status !== "Completed" || !v.vaccinationDate) return false;
      const d = new Date(v.vaccinationDate);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      total: active.length,
      dueToday: active.filter((v) => v.status === "Due Today").length,
      upcoming: active.filter((v) => v.status === "Upcoming").length,
      overdue: active.filter((v) => v.status === "Overdue").length,
      completedThisMonth,
      deletedCount,
    };
  }, [vaccinations]);

  // ==========================
  // PAGINATION
  // ==========================
  const totalPages = Math.max(
    1,
    Math.ceil(filteredVaccinations.length / PAGE_SIZE),
  );
  const paginatedVaccinations = filteredVaccinations.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ==========================
  // EXPORT
  // ==========================
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
      item.pen,
      item.vaccineName,
      item.vaccineType,
      item.batchNumber || "-",
      item.manufacturer || "-",
      item.quantityUsed,
      item.unit,
      item.birdsVaccinated,
      item.vaccinationDate
        ? new Date(item.vaccinationDate).toLocaleDateString()
        : "-",
      item.nextDueDate ? new Date(item.nextDueDate).toLocaleDateString() : "-",
      item.route,
      item.cost,
      item.status,
    ]);

  const handleExportExcel = () => {
    if (filteredVaccinations.length === 0) {
      toast.error("No records to export");
      return;
    }
    const worksheet = XLSX.utils.aoa_to_sheet([exportColumns, ...exportRows()]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Vaccinations");
    XLSX.writeFile(
      workbook,
      `vaccination-records-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleExportPDF = () => {
    if (filteredVaccinations.length === 0) {
      toast.error("No records to export");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Vaccination Records", 14, 15);
    autoTable(doc, {
      head: [exportColumns],
      body: exportRows(),
      startY: 20,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [22, 163, 74] },
    });
    doc.save(
      `vaccination-records-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-14 w-14 border-b-4 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">💉 Vaccination Management</h1>
        <button
          onClick={() => loadVaccinations(false)}
          disabled={refreshing}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* STATISTICS */}
      <div
        className={`grid grid-cols-2 md:grid-cols-5 ${
          role === "superadmin" ? "lg:grid-cols-6" : ""
        } gap-4 mb-6`}
      >
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Total Vaccinations</p>
          <h2 className="text-2xl font-bold text-green-700">{stats.total}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Due Today</p>
          <h2 className="text-2xl font-bold text-yellow-600">
            {stats.dueToday}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Upcoming</p>
          <h2 className="text-2xl font-bold text-blue-600">{stats.upcoming}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Overdue</p>
          <h2 className="text-2xl font-bold text-red-600">{stats.overdue}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Completed This Month</p>
          <h2 className="text-2xl font-bold text-purple-600">
            {stats.completedThisMonth}
          </h2>
        </div>
        {role === "superadmin" && (
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Deleted Records</p>
            <h2 className="text-2xl font-bold text-gray-500">
              {stats.deletedCount}
            </h2>
          </div>
        )}
      </div>

      {/* FORM */}
      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-5">Add Vaccination Record</h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <select
            name="pen"
            value={formData.pen}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          >
            <option value="">Select Pen</option>
            {PENS.map((pen) => (
              <option key={pen} value={pen}>
                {pen}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="vaccineName"
            placeholder="Vaccine Name"
            value={formData.vaccineName}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />

          <select
            name="vaccineType"
            value={formData.vaccineType}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          >
            <option value="">Select Vaccine Type</option>
            {VACCINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            type="text"
            name="batchNumber"
            placeholder="Batch Number"
            value={formData.batchNumber}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <input
            type="text"
            name="manufacturer"
            placeholder="Manufacturer"
            value={formData.manufacturer}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <input
            type="number"
            name="quantityUsed"
            placeholder="Quantity Used"
            value={formData.quantityUsed}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />

          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="border p-2 rounded"
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="birdsVaccinated"
            placeholder="Birds Vaccinated"
            value={formData.birdsVaccinated}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />

          <input
            type="date"
            name="vaccinationDate"
            value={formData.vaccinationDate}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          />

          <input
            type="date"
            name="nextDueDate"
            value={formData.nextDueDate}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <select
            name="route"
            value={formData.route}
            onChange={handleChange}
            className="border p-2 rounded"
            required
          >
            <option value="">Select Route</option>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="cost"
            placeholder="Cost"
            value={formData.cost}
            onChange={handleChange}
            className="border p-2 rounded"
          />

          <textarea
            name="notes"
            placeholder="Notes"
            value={formData.notes}
            onChange={handleChange}
            rows="2"
            className="border p-2 rounded md:col-span-3"
          />

          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white p-3 rounded md:col-span-3"
          >
            Save Vaccination Record
          </button>
        </form>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <select
          value={penFilter}
          onChange={(e) => setPenFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="All">All Pens</option>
          {PENS.map((pen) => (
            <option key={pen} value={pen}>
              {pen}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="All">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search by pen, vaccine, batch, manufacturer, date..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded flex-1"
        />

        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            type="button"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Export PDF
          </button>
        </div>
      </div>

      {filteredVaccinations.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-16 text-center">
          <div className="text-6xl mb-4">💉</div>
          <h2 className="text-2xl font-bold">No vaccination records found</h2>
          <p className="text-gray-500 mt-2">
            Add a record above or adjust your filters.
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="overflow-x-auto hidden md:block bg-white rounded-xl shadow">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-green-600 text-white">
                <tr>
                  <th className="p-3 text-left">Pen</th>
                  <th className="p-3 text-left">Vaccine</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Batch</th>
                  <th className="p-3 text-left">Qty</th>
                  <th className="p-3 text-left">Birds</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Next Due</th>
                  <th className="p-3 text-left">Route</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">By</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVaccinations.map((item) => (
                  <tr
                    key={item._id}
                    className={`border-b hover:bg-green-50 transition ${
                      item.isDeleted ? "bg-red-50 opacity-70" : ""
                    }`}
                  >
                    <td className="p-3 whitespace-nowrap">{item.pen}</td>
                    <td className="p-3 font-medium whitespace-nowrap">
                      {item.vaccineName}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.vaccineType}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.batchNumber || "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.quantityUsed} {item.unit}
                    </td>
                    <td className="p-3">{item.birdsVaccinated}</td>
                    <td className="p-3 whitespace-nowrap">
                      {item.vaccinationDate
                        ? new Date(item.vaccinationDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.nextDueDate
                        ? new Date(item.nextDueDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap">{item.route}</td>
                    <td className="p-3">
                      {item.isDeleted ? (
                        <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                          Deleted
                        </span>
                      ) : (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            STATUS_COLORS[item.status]
                          }`}
                        >
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm">
                      {item.isDeleted ? (
                        <div>
                          <p className="text-gray-600">
                            {item.deletedByName || "Unknown"}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {item.deletedByRole || ""}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p>{item.administeredBy?.name || "-"}</p>
                          <p className="text-gray-400 text-xs">
                            {item.administeredBy?.role || ""}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {item.isDeleted ? (
                        role === "superadmin" && (
                          <button
                            onClick={() => handleRestore(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                          >
                            Restore
                          </button>
                        )
                      ) : canEdit ? (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS */}
          <div className="md:hidden space-y-3">
            {paginatedVaccinations.map((item) => (
              <div
                key={item._id}
                className={`bg-white rounded-xl shadow p-4 ${
                  item.isDeleted ? "opacity-70 border border-red-200" : ""
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{item.vaccineName}</p>
                    <p className="text-sm text-gray-500">{item.pen}</p>
                  </div>
                  {item.isDeleted ? (
                    <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                      Deleted
                    </span>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        STATUS_COLORS[item.status]
                      }`}
                    >
                      {item.status}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <p>
                    <span className="text-gray-500">Date:</span>{" "}
                    {item.vaccinationDate
                      ? new Date(item.vaccinationDate).toLocaleDateString()
                      : "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Next Due:</span>{" "}
                    {item.nextDueDate
                      ? new Date(item.nextDueDate).toLocaleDateString()
                      : "-"}
                  </p>
                  <p>
                    <span className="text-gray-500">Qty:</span>{" "}
                    {item.quantityUsed} {item.unit}
                  </p>
                  <p>
                    <span className="text-gray-500">Birds:</span>{" "}
                    {item.birdsVaccinated}
                  </p>
                </div>

                <div className="mt-3">
                  {item.isDeleted ? (
                    role === "superadmin" && (
                      <button
                        onClick={() => handleRestore(item)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
                      >
                        Restore
                      </button>
                    )
                  ) : canEdit ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* PAGINATION */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 bg-white rounded-xl shadow p-4">
            <div className="text-gray-600 text-sm">
              Showing{" "}
              <strong>
                {filteredVaccinations.length === 0
                  ? 0
                  : (page - 1) * PAGE_SIZE + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(page * PAGE_SIZE, filteredVaccinations.length)}
              </strong>{" "}
              of <strong>{filteredVaccinations.length}</strong> records
            </div>

            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <div className="px-4 py-2 rounded-lg bg-green-600 text-white">
                {page} / {totalPages}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-5">Edit Vaccination Record</h2>
            <form
              onSubmit={handleUpdate}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <select
                name="pen"
                value={editData.pen}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              >
                <option value="">Select Pen</option>
                {PENS.map((pen) => (
                  <option key={pen} value={pen}>
                    {pen}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="vaccineName"
                placeholder="Vaccine Name"
                value={editData.vaccineName}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              />

              <select
                name="vaccineType"
                value={editData.vaccineType}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              >
                <option value="">Select Vaccine Type</option>
                {VACCINE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <input
                type="text"
                name="batchNumber"
                placeholder="Batch Number"
                value={editData.batchNumber}
                onChange={handleEditChange}
                className="border p-2 rounded"
              />

              <input
                type="text"
                name="manufacturer"
                placeholder="Manufacturer"
                value={editData.manufacturer}
                onChange={handleEditChange}
                className="border p-2 rounded"
              />

              <input
                type="number"
                name="quantityUsed"
                placeholder="Quantity Used"
                value={editData.quantityUsed}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              />

              <select
                name="unit"
                value={editData.unit}
                onChange={handleEditChange}
                className="border p-2 rounded"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="birdsVaccinated"
                placeholder="Birds Vaccinated"
                value={editData.birdsVaccinated}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              />

              <input
                type="date"
                name="vaccinationDate"
                value={editData.vaccinationDate}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              />

              <input
                type="date"
                name="nextDueDate"
                value={editData.nextDueDate}
                onChange={handleEditChange}
                className="border p-2 rounded"
              />

              <select
                name="route"
                value={editData.route}
                onChange={handleEditChange}
                className="border p-2 rounded"
                required
              >
                <option value="">Select Route</option>
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <input
                type="number"
                name="cost"
                placeholder="Cost"
                value={editData.cost}
                onChange={handleEditChange}
                className="border p-2 rounded"
              />

              <textarea
                name="notes"
                placeholder="Notes"
                value={editData.notes}
                onChange={handleEditChange}
                rows="2"
                className="border p-2 rounded md:col-span-3"
              />

              <div className="flex justify-end gap-3 md:col-span-3 mt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="border px-5 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-2">
                Delete Vaccination Record?
              </h2>
              <p className="text-gray-600">
                Are you sure you want to delete the record for
              </p>
              <p className="font-bold text-lg mt-2">
                {selectedRecord?.vaccineName} — {selectedRecord?.pen}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
