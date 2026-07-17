import { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  fetchProductions,
  createProduction,
  deleteProduction,
} from "../services/productionService";
import socket from "../services/socket";

const user = JSON.parse(localStorage.getItem("user") || "{}");
const role = user?.role || localStorage.getItem("role");

const pens = [
  "Battery Cage Row 1",
  "Battery Cage Row 2",
  "Battery Cage Row 3",
  "Deep Litter Pen 1",
  "Deep Litter Pen 2",
  "Deep Litter Pen 3",
  "Sick Bay",
  "Pen 150",
];

const PAGE_SIZE = 10;

const emptyFormData = {
  pen: "",
  date: "",
  days: "",
  openingStock: "",
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

const Production = () => {
  const [productions, setProductions] = useState([]);
  const [selectedPen, setSelectedPen] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState(emptyFormData);

  // ==========================
  // LOAD PRODUCTIONS
  // ==========================
  const loadProductions = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const data = await fetchProductions();
      setProductions(data);
    } catch (error) {
      console.error("LOAD ERROR:", error);
      toast.error("Failed to load production records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProductions();
  }, []);

  // ==========================
  // SOCKET.IO LIVE UPDATES
  // NOTE: assumes the backend emits "newProduction" and "productionDeleted"
  // from productionController.js, mirroring the newOrder/orderDeleted
  // pattern in orderController.js. Update event names here if yours differ.
  // ==========================
  useEffect(() => {
    const handleNewProduction = (record) => {
      setProductions((prev) => [record, ...prev]);
      toast.success(`New production record added for ${record.pen}`);
    };

    const handleProductionDeleted = (payload) => {
      setProductions((prev) =>
        prev.map((item) =>
          item._id === payload.id
            ? {
                ...item,
                isDeleted: true,
                deletedBy: payload.deletedBy ?? item.deletedBy,
                deletedByRole: payload.deletedByRole ?? item.deletedByRole,
                deletedAt: payload.deletedAt ?? new Date().toISOString(),
              }
            : item,
        ),
      );
      toast.info("A production record was deleted");
    };

    socket.on("newProduction", handleNewProduction);
    socket.on("productionDeleted", handleProductionDeleted);

    return () => {
      socket.off("newProduction", handleNewProduction);
      socket.off("productionDeleted", handleProductionDeleted);
    };
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await createProduction({
        ...formData,

        days: Number(formData.days),
        openingStock: Number(formData.openingStock),
        mortality: Number(formData.mortality),
        sickBirds: Number(formData.sickBirds),
        feedBagsConsumed: Number(formData.feedBagsConsumed),
        waterConsumed: Number(formData.waterConsumed),
        cratesProduced: Number(formData.cratesProduced),
        extraEggPieces: Number(formData.extraEggPieces),
        miscarriageProduction: Number(formData.miscarriageProduction),
        crackedEggs: Number(formData.crackedEggs),
      });

      toast.success("Production record saved successfully");

      loadProductions(false);

      setFormData(emptyFormData);
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message || "Failed to save production record",
      );
    }
  };

  // ==========================
  // DELETE (confirmation modal)
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
      await deleteProduction(selectedRecord._id);
      toast.success("Production record deleted");
      loadProductions(false);
      setShowDeleteModal(false);
      setSelectedRecord(null);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete production record");
    } finally {
      setDeleting(false);
    }
  };

  const closingStock =
    Number(formData.openingStock || 0) - Number(formData.mortality || 0);

  const totalEggs =
    Number(formData.cratesProduced || 0) * 30 +
    Number(formData.extraEggPieces || 0);

  const productionPercentage =
    closingStock > 0 ? ((totalEggs / closingStock) * 100).toFixed(2) : 0;

  // ==========================
  // FILTERING (pen + search)
  // ==========================
  const penFiltered =
    selectedPen === "All"
      ? productions
      : productions.filter((item) => item.pen === selectedPen);

  const filteredProductions = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return penFiltered;

    return penFiltered.filter((item) => {
      const dateStr = item.date ? new Date(item.date).toLocaleDateString() : "";
      return (
        item.pen?.toLowerCase().includes(keyword) ||
        dateStr.toLowerCase().includes(keyword) ||
        item.drugsUsed?.toLowerCase().includes(keyword) ||
        item.remarks?.toLowerCase().includes(keyword)
      );
    });
  }, [penFiltered, search]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedPen]);

  // ==========================
  // STATISTICS
  // ==========================
  const stats = useMemo(() => {
    const active = productions.filter((p) => !p.isDeleted);
    const deletedCount = productions.filter((p) => p.isDeleted).length;

    const todayCount = active.filter(
      (p) =>
        p.date && new Date(p.date).toDateString() === new Date().toDateString(),
    ).length;

    const totalEggsProduced = active.reduce(
      (sum, p) => sum + (Number(p.totalEggs) || 0),
      0,
    );

    const percentages = active
      .map((p) => Number(p.productionPercentage))
      .filter((n) => !Number.isNaN(n) && n > 0);

    const avgPercentage =
      percentages.length > 0
        ? (percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(
            2,
          )
        : "0.00";

    return {
      totalRecords: active.length,
      todayCount,
      totalEggsProduced,
      avgPercentage,
      deletedCount,
    };
  }, [productions]);

  // ==========================
  // PAGINATION
  // ==========================
  const totalPages = Math.max(
    1,
    Math.ceil(filteredProductions.length / PAGE_SIZE),
  );
  const paginatedProductions = filteredProductions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ==========================
  // EXPORT
  // ==========================
  const exportColumns = [
    "Pen",
    "Date",
    "Opening",
    "Mortality",
    "Closing",
    "Crates",
    "Extra Eggs",
    "Total Eggs",
    "%",
  ];

  const exportRows = () =>
    filteredProductions.map((item) => [
      item.pen,
      item.date ? new Date(item.date).toLocaleDateString() : "",
      item.openingStock,
      item.mortality,
      item.closingStock,
      item.cratesProduced,
      item.extraEggPieces,
      item.totalEggs,
      `${item.productionPercentage}%`,
    ]);

  const handleExportExcel = () => {
    if (filteredProductions.length === 0) {
      toast.error("No records to export");
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([exportColumns, ...exportRows()]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production");
    XLSX.writeFile(
      workbook,
      `production-records-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const handleExportPDF = () => {
    if (filteredProductions.length === 0) {
      toast.error("No records to export");
      return;
    }

    const doc = new jsPDF();
    doc.text("Daily Egg Production", 14, 15);
    autoTable(doc, {
      head: [exportColumns],
      body: exportRows(),
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] },
    });
    doc.save(`production-records-${new Date().toISOString().slice(0, 10)}.pdf`);
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
        <h1 className="text-3xl font-bold">Daily Egg Production</h1>
        <button
          onClick={() => loadProductions(false)}
          disabled={refreshing}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* STATISTICS */}
      <div
        className={`grid grid-cols-2 md:grid-cols-4 ${
          role === "superadmin" ? "lg:grid-cols-5" : ""
        } gap-4 mb-6`}
      >
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Total Records</p>
          <h2 className="text-2xl font-bold text-green-700">
            {stats.totalRecords}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Today's Production</p>
          <h2 className="text-2xl font-bold text-blue-600">
            {stats.todayCount}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Total Eggs Produced</p>
          <h2 className="text-2xl font-bold text-yellow-600">
            {stats.totalEggsProduced}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Avg. Production %</p>
          <h2 className="text-2xl font-bold text-purple-600">
            {stats.avgPercentage}%
          </h2>
        </div>
        {role === "superadmin" && (
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-sm">Deleted Records</p>
            <h2 className="text-2xl font-bold text-red-600">
              {stats.deletedCount}
            </h2>
          </div>
        )}
      </div>

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
          <option value="">Select Production Unit</option>

          {pens.map((pen) => (
            <option key={pen} value={pen}>
              {pen}
            </option>
          ))}
        </select>

        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="number"
          name="days"
          placeholder="Age (Days)"
          value={formData.days}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="openingStock"
          placeholder="Opening Stock"
          value={formData.openingStock}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />

        <input
          type="number"
          name="mortality"
          placeholder="Mortality"
          value={formData.mortality}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="sickBirds"
          placeholder="Sick Birds"
          value={formData.sickBirds}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="feedBagsConsumed"
          placeholder="Feed Bags Consumed"
          value={formData.feedBagsConsumed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="waterConsumed"
          placeholder="Water Consumed"
          value={formData.waterConsumed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="text"
          name="drugsUsed"
          placeholder="Drugs Used"
          value={formData.drugsUsed}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="cratesProduced"
          placeholder="Egg Crates"
          value={formData.cratesProduced}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="extraEggPieces"
          placeholder="Extra Egg Pieces"
          value={formData.extraEggPieces}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="miscarriageProduction"
          placeholder="Miscarriage Eggs"
          value={formData.miscarriageProduction}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <input
          type="number"
          name="crackedEggs"
          placeholder="Cracked Eggs"
          value={formData.crackedEggs}
          onChange={handleChange}
          className="border p-2 rounded"
        />

        <textarea
          name="remarks"
          placeholder="Remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="3"
          className="border p-2 rounded md:col-span-3"
        />

        <div className="bg-gray-100 p-4 rounded md:col-span-3">
          <p>
            <strong>Closing Stock:</strong> {closingStock}
          </p>

          <p>
            <strong>Total Eggs:</strong> {totalEggs}
          </p>

          <p>
            <strong>Production %:</strong> {productionPercentage}%
          </p>
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white p-3 rounded md:col-span-3"
        >
          Save Production Record
        </button>
      </form>

      <div className="mt-8">
        {/* FILTER BAR */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <select
            value={selectedPen}
            onChange={(e) => setSelectedPen(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="All">All Pens</option>

            {pens.map((pen) => (
              <option key={pen} value={pen}>
                {pen}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by pen, date, drugs used, remarks..."
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

        {filteredProductions.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-16 text-center">
            <div className="text-6xl mb-4">🐔</div>
            <h2 className="text-2xl font-bold">No production records yet</h2>
            <p className="text-gray-500 mt-2">
              Start by adding today's production above.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Pen</th>
                    <th className="border p-2">Date</th>
                    <th className="border p-2">Opening</th>
                    <th className="border p-2">Mortality</th>
                    <th className="border p-2">Closing</th>
                    <th className="border p-2">Crates</th>
                    <th className="border p-2">Extra Eggs</th>
                    <th className="border p-2">Total Eggs</th>
                    <th className="border p-2">%</th>
                    <th className="border p-2">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedProductions.map((item) => (
                    <tr
                      key={item._id}
                      className={item.isDeleted ? "bg-red-50 opacity-70" : ""}
                    >
                      <td className="border p-2">{item.pen}</td>

                      <td className="border p-2">
                        {new Date(item.date).toLocaleDateString()}
                      </td>

                      <td className="border p-2">{item.openingStock}</td>

                      <td className="border p-2">{item.mortality}</td>

                      <td className="border p-2">{item.closingStock}</td>

                      <td className="border p-2">{item.cratesProduced}</td>

                      <td className="border p-2">{item.extraEggPieces}</td>

                      <td className="border p-2">{item.totalEggs}</td>

                      <td className="border p-2">
                        {item.productionPercentage}%
                      </td>

                      <td className="border p-2">
                        {item.isDeleted ? (
                          <div className="space-y-1">
                            <span className="inline-block bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                              Deleted
                            </span>

                            <p className="text-xs text-gray-600">
                              by{" "}
                              {item.deletedBy?.name ||
                                item.deletedBy ||
                                "Unknown"}
                            </p>

                            <p className="text-xs text-gray-500">
                              {item.deletedBy?.role ||
                                item.deletedByRole ||
                                "N/A"}
                            </p>

                            {item.deletedAt && (
                              <p className="text-xs text-gray-400">
                                {new Date(item.deletedAt).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS */}
            <div className="md:hidden space-y-3">
              {paginatedProductions.map((item) => (
                <div
                  key={item._id}
                  className={`bg-white rounded-xl shadow p-4 ${
                    item.isDeleted ? "opacity-70 border border-red-200" : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{item.pen}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="font-bold text-green-700">
                      {item.productionPercentage}%
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <p>
                      <span className="text-gray-500">Closing:</span>{" "}
                      {item.closingStock}
                    </p>
                    <p>
                      <span className="text-gray-500">Total Eggs:</span>{" "}
                      {item.totalEggs}
                    </p>
                    <p>
                      <span className="text-gray-500">Crates:</span>{" "}
                      {item.cratesProduced}
                    </p>
                    <p>
                      <span className="text-gray-500">Mortality:</span>{" "}
                      {item.mortality}
                    </p>
                  </div>

                  <div className="mt-3">
                    {item.isDeleted ? (
                      <div className="text-xs text-gray-500">
                        Deleted by{" "}
                        {item.deletedBy?.name || item.deletedBy || "Unknown"}
                        {item.deletedBy?.role || item.deletedByRole
                          ? ` (${item.deletedBy?.role || item.deletedByRole})`
                          : ""}
                      </div>
                    ) : (
                      <button
                        onClick={() => openDeleteModal(item)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* PAGINATION */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 bg-white rounded-xl shadow p-4">
              <div className="text-gray-600 text-sm">
                Showing{" "}
                <strong>
                  {filteredProductions.length === 0
                    ? 0
                    : (page - 1) * PAGE_SIZE + 1}
                </strong>{" "}
                to{" "}
                <strong>
                  {Math.min(page * PAGE_SIZE, filteredProductions.length)}
                </strong>{" "}
                of <strong>{filteredProductions.length}</strong> records
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
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>

              <h2 className="text-2xl font-bold mb-2">
                Delete Production Record?
              </h2>

              <p className="text-gray-600">
                Are you sure you want to delete the record for
              </p>

              <p className="font-bold text-lg mt-2">
                {selectedRecord?.pen} —{" "}
                {selectedRecord?.date &&
                  new Date(selectedRecord.date).toLocaleDateString()}
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
};

export default Production;
