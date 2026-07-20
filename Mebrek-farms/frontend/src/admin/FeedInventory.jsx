import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  fetchFeeds,
  createFeed,
  updateFeed,
  deleteFeed,
} from "../services/feedService";
import socket from "../services/socket";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Tooltip,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export default function FeedInventory() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    quantity: "",
    unit: "bags",
    pricePerUnit: "",
    supplier: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    unit: "bags",
    pricePerUnit: "",
    supplier: "",
  });

  const ITEMS_PER_PAGE = 10;
  const [page, setPage] = useState(1);

  // ================= LOAD FEEDS =================
  const loadFeeds = async () => {
    try {
      setLoading(true);
      const data = await fetchFeeds();
      setFeeds(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load feed inventory.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadFeeds();
  }, []);

  // ================= REAL-TIME SOCKET =================

  useEffect(() => {
    socket.on("feedCreated", (newFeed) => {
      setFeeds((prev) => [newFeed, ...prev]);

      toast.success("New feed added");
    });

    socket.on("feedUpdated", (updatedFeed) => {
      setFeeds((prev) =>
        prev.map((feed) => (feed._id === updatedFeed._id ? updatedFeed : feed)),
      );

      toast.info("Feed updated");
    });

    socket.on("feedDeleted", (deletedFeed) => {
      const role =
        JSON.parse(localStorage.getItem("user") || "{}")?.role ||
        localStorage.getItem("role");

      if (role === "superadmin") {
        setFeeds((prev) =>
          prev.map((feed) =>
            feed._id === deletedFeed._id ? deletedFeed : feed,
          ),
        );
      } else {
        setFeeds((prev) => prev.filter((feed) => feed._id !== deletedFeed._id));
      }

      toast.warning("Feed deleted");
    });

    return () => {
      socket.off("feedCreated");
      socket.off("feedUpdated");
      socket.off("feedDeleted");
    };
  }, []);

  // ================= SEARCH =================
  const filteredFeeds = useMemo(() => {
    return feeds.filter((feed) => {
      const keyword = search.toLowerCase();
      return (
        feed.name?.toLowerCase().includes(keyword) ||
        feed.supplier?.toLowerCase().includes(keyword)
      );
    });
  }, [feeds, search]);

  // ================= PAGINATION =================
  const totalPages = Math.ceil(filteredFeeds.length / ITEMS_PER_PAGE);
  const paginatedFeeds = filteredFeeds.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  // ================= DASHBOARD CARDS =================
  const totalFeedTypes = feeds.length;
  const totalQuantity = feeds.reduce(
    (sum, feed) => sum + Number(feed.quantity || 0),
    0,
  );
  const lowStockCount = feeds.filter(
    (feed) => Number(feed.quantity) <= Number(feed.lowStockThreshold || 5),
  ).length;
  const inventoryValue = feeds.reduce(
    (sum, feed) =>
      sum + Number(feed.quantity || 0) * Number(feed.pricePerUnit || 0),
    0,
  );

  // ================= CHART DATA =================
  const chartData = filteredFeeds.map((feed) => ({
    name: feed.name,
    quantity: Number(feed.quantity),
  }));

  const stockSummary = [
    {
      name: "Low",
      value: lowStockCount,
    },
    {
      name: "Available",
      value: totalFeedTypes - lowStockCount,
    },
  ];

  // Cycled per bar so each feed gets a distinct color instead of one
  // flat fill across every bar.
  const BAR_COLORS = [
    "#16a34a",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
  ];

  // ================= CREATE FEED =================
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await createFeed({
        ...formData,
        quantity: Number(formData.quantity),
        pricePerUnit: Number(formData.pricePerUnit),
      });
      toast.success("Feed added successfully.");
      setFormData({
        name: "",
        quantity: "",
        unit: "bags",
        pricePerUnit: "",
        supplier: "",
      });
      // No need to call loadFeeds()
      // Socket.IO will automatically add the new feed.
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.error || "Unable to save feed inventory.",
      );
    } finally {
      setSaving(false);
    }
  };
  // ================= DELETE =================
  const confirmDelete = (feed) => {
    setSelectedFeed(feed);
    setShowDeleteModal(true);
  };
  const cancelDelete = () => {
    setSelectedFeed(null);
    setShowDeleteModal(false);
  };

  // ================= EDIT =================
  const openEditModal = (feed) => {
    setEditingFeed(feed);
    setEditData({
      name: feed.name,
      quantity: feed.quantity,
      unit: feed.unit,
      pricePerUnit: feed.pricePerUnit,
      supplier: feed.supplier,
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setEditingFeed(null);
    setShowEditModal(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateFeed(editingFeed._id, {
        ...editData,
        quantity: Number(editData.quantity),
        pricePerUnit: Number(editData.pricePerUnit),
      });
      toast.success("Feed updated successfully.");
      closeEditModal();
      // Socket.IO updates the table automatically.
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Unable to update feed.");
    }
  };
  const handleDelete = async () => {
    if (!selectedFeed) return;
    try {
      await deleteFeed(selectedFeed._id);
      toast.success("Feed deleted successfully.");
      cancelDelete();
      // feedDeleted socket event updates everyone automatically.
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete feed.");
    }
  };
  // ================= REFRESH =================
  const handleRefresh = () => {
    loadFeeds();
    toast.success("Inventory refreshed.");
  };

  // ================= EXPORT EXCEL =================
  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredFeeds.map((feed) => ({
        Feed: feed.name,
        Quantity: feed.quantity,
        Unit: feed.unit,
        Price: feed.pricePerUnit,
        Supplier: feed.supplier,
        Status:
          feed.quantity <= feed.lowStockThreshold ? "Low Stock" : "In Stock",
      })),
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Feed Inventory");
    XLSX.writeFile(workbook, "FeedInventory.xlsx");

    toast.success("Excel exported.");
  };

  // ================= EXPORT PDF =================
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Feed Inventory Report", 14, 15);

    autoTable(doc, {
      startY: 25,
      head: [["Feed", "Quantity", "Price", "Supplier", "Status"]],
      body: filteredFeeds.map((feed) => [
        feed.name,
        `${feed.quantity} ${feed.unit}`,
        `₦${feed.pricePerUnit}`,
        feed.supplier || "-",
        feed.quantity <= feed.lowStockThreshold ? "Low Stock" : "In Stock",
      ]),
    });

    doc.save("FeedInventory.pdf");

    toast.success("PDF exported.");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-green-700">
            🌽 Feed Inventory
          </h1>

          <p className="text-gray-500 mt-1">
            Manage poultry feed stock efficiently
          </p>
        </div>

        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={exportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg"
          >
            Excel
          </button>

          <button
            onClick={exportPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg"
          >
            PDF
          </button>

          <button
            onClick={handleRefresh}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Feed Types</p>

          <h2 className="text-3xl font-bold text-green-700">
            {totalFeedTypes}
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Total Quantity</p>

          <h2 className="text-3xl font-bold text-blue-600">
            {totalQuantity} bags
          </h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Low Stock</p>

          <h2 className="text-3xl font-bold text-red-600">{lowStockCount}</h2>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500 text-sm">Inventory Value</p>

          <h2 className="text-3xl font-bold text-purple-700">
            ₦{inventoryValue.toLocaleString()}
          </h2>
        </div>
      </div>

      {/* SUMMARY CHARTS */}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-bold mb-4">Feed Quantity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow p-5">
          <h3 className="font-bold mb-4">Stock Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stockSummary} dataKey="value" label>
                <Cell fill="#16a34a" />
                <Cell fill="#dc2626" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SEARCH */}

      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <input
          type="text"
          placeholder="Search by feed name or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-green-500 outline-none"
        />
      </div>

      {/* FORM */}

      <div className="bg-white rounded-xl shadow p-6 mb-8">
        <h2 className="text-xl font-bold mb-5">Add Feed Inventory</h2>

        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Feed Name"
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="number"
            placeholder="Quantity"
            value={formData.quantity}
            onChange={(e) =>
              setFormData({
                ...formData,
                quantity: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="number"
            placeholder="Price Per Unit"
            value={formData.pricePerUnit}
            onChange={(e) =>
              setFormData({
                ...formData,
                pricePerUnit: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
            required
          />

          <input
            type="text"
            placeholder="Supplier"
            value={formData.supplier}
            onChange={(e) =>
              setFormData({
                ...formData,
                supplier: e.target.value,
              })
            }
            className="border p-3 rounded-lg"
          />

          <button
            disabled={saving}
            className="md:col-span-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white py-3 rounded-lg transition"
          >
            {saving ? "Saving..." : "Add Feed"}
          </button>
        </form>
      </div>

      {/* LOADING */}

      {loading ? (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto mb-4"></div>

          <p className="text-gray-500">Loading feed inventory...</p>
        </div>
      ) : (
        <div>
          {/* TABLE */}
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {filteredFeeds.length === 0 ? (
              <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-600">
                  No Feed Records Found
                </h3>
                <p className="text-gray-400 mt-2">
                  Add your first feed inventory record.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-green-600 text-white">
                    <tr>
                      <th className="p-4 text-left">Feed</th>
                      <th className="p-4 text-left">Quantity</th>
                      <th className="p-4 text-left">Price</th>
                      <th className="p-4 text-left">Supplier</th>
                      <th className="p-4 text-left">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFeeds.map((feed) => (
                      <tr
                        key={feed._id}
                        className="border-b hover:bg-green-50 transition"
                      >
                        <td className="p-4 font-medium">{feed.name}</td>
                        <td className="p-4">
                          {feed.quantity} {feed.unit}
                        </td>
                        <td className="p-4">
                          ₦{Number(feed.pricePerUnit).toLocaleString()}
                        </td>
                        <td className="p-4">{feed.supplier || "-"}</td>
                        <td className="p-4">
                          {feed.isDeleted ? (
                            <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-700 text-sm font-semibold">
                              Deleted by {feed.deletedBy || "Unknown"}
                              {feed.deletedByRole
                                ? ` (${feed.deletedByRole})`
                                : ""}
                            </span>
                          ) : feed.quantity <= feed.lowStockThreshold ? (
                            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => openEditModal(feed)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => confirmDelete(feed)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PAGINATION */}
          <div className="flex justify-between items-center mt-6">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="border px-4 py-2 rounded"
            >
              Previous
            </button>

            <span>
              Page {page} of {totalPages || 1}
            </span>

            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="border px-4 py-2 rounded"
            >
              Next
            </button>
          </div>

          {/* EDIT MODAL */}
          {showEditModal && editingFeed && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-5">Edit Feed</h2>
                <form onSubmit={handleUpdate} className="grid gap-4">
                  <input
                    className="border p-3 rounded"
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        name: e.target.value,
                      })
                    }
                  />

                  <input
                    type="number"
                    className="border p-3 rounded"
                    value={editData.quantity}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        quantity: e.target.value,
                      })
                    }
                  />

                  <input
                    type="number"
                    className="border p-3 rounded"
                    value={editData.pricePerUnit}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        pricePerUnit: e.target.value,
                      })
                    }
                  />

                  <input
                    className="border p-3 rounded"
                    value={editData.supplier}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        supplier: e.target.value,
                      })
                    }
                  />

                  <div className="flex justify-end gap-3 mt-4">
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
          {showDeleteModal && selectedFeed && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                <h2 className="text-2xl font-bold mb-3">Delete Feed</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete
                  <span className="font-bold"> {selectedFeed.name}</span>?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={cancelDelete}
                    className="px-5 py-2 rounded-lg border"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
