import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import {
  fetchFeeds,
  createFeed,
  updateFeed,
  deleteFeed,
} from "../services/feedService";

import socket from "../services/socket";

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
  CartesianGrid,
  Legend,
} from "recharts";

const ITEMS_PER_PAGE = 10;

const BAR_COLORS = [
  "#638b68",
  "#6d91a7",
  "#c39a58",
  "#b96b65",
  "#8b78a8",
  "#6d9d9a",
  "#ad8064",
  "#8a9b62",
];

const FEED_UNITS = ["bags", "kg", "tonnes"];

const todayISO = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const toDateInputValue = (value) => {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDate = (value) => {
  const dateValue = toDateInputValue(value);

  if (!dateValue) return "-";

  const [year, month, day] = dateValue.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntilExpiry = (expiryDate) => {
  const dateValue = toDateInputValue(expiryDate);

  if (!dateValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  const expiryUTC = Date.UTC(year, month - 1, day);

  const [todayYear, todayMonth, todayDay] = todayISO().split("-").map(Number);

  const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay);

  return Math.round((expiryUTC - todayUTC) / 86400000);
};

const getNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const formatCurrency = (value) =>
  `₦${getNumber(value).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  })}`;

const getLowStockThreshold = (feed) => {
  const threshold = Number(feed.lowStockThreshold);

  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 5;
};

const isLowStock = (feed) =>
  getNumber(feed.quantity) <= getLowStockThreshold(feed);

const getRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    return String(user?.role || localStorage.getItem("role") || "")
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

const extractFeeds = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.feeds)) return response.feeds;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.feeds)) {
    return response.data.feeds;
  }

  return [];
};

const createInitialForm = () => ({
  name: "",
  quantity: "",
  unit: "bags",
  pricePerUnit: "",
  supplier: "",
  purchaseDate: todayISO(),
  expiryDate: "",
});

export default function FeedInventory() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);

  const [formData, setFormData] = useState(createInitialForm);
  const [editData, setEditData] = useState(createInitialForm);

  const isSuperadmin = getRole() === "superadmin";

  // ============================================================
  // LOAD FEEDS
  // ============================================================

  const loadFeeds = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetchFeeds();
      const records = extractFeeds(response);

      setFeeds(records);

      return true;
    } catch (error) {
      console.error("Feed inventory loading error:", error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to load feed inventory.",
      );

      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  // ============================================================
  // SOCKET EVENTS
  // ============================================================

  useEffect(() => {
    const handleFeedCreated = (newFeed) => {
      if (!newFeed?._id) return;

      setFeeds((previous) => {
        const exists = previous.some((feed) => feed._id === newFeed._id);

        if (exists) {
          return previous.map((feed) =>
            feed._id === newFeed._id ? newFeed : feed,
          );
        }

        return [newFeed, ...previous];
      });

      toast.success("New feed added.");
    };

    const handleFeedUpdated = (updatedFeed) => {
      if (!updatedFeed?._id) return;

      setFeeds((previous) => {
        const exists = previous.some((feed) => feed._id === updatedFeed._id);

        if (!exists) return [updatedFeed, ...previous];

        return previous.map((feed) =>
          feed._id === updatedFeed._id ? updatedFeed : feed,
        );
      });

      toast.info("Feed inventory updated.");
    };

    const handleFeedDeleted = (deletedFeed) => {
      if (!deletedFeed?._id) return;

      if (isSuperadmin) {
        setFeeds((previous) =>
          previous.map((feed) =>
            feed._id === deletedFeed._id ? deletedFeed : feed,
          ),
        );
      } else {
        setFeeds((previous) =>
          previous.filter((feed) => feed._id !== deletedFeed._id),
        );
      }

      toast.warning("Feed deleted.");
    };

    socket.on("feedCreated", handleFeedCreated);
    socket.on("feedUpdated", handleFeedUpdated);
    socket.on("feedDeleted", handleFeedDeleted);

    return () => {
      socket.off("feedCreated", handleFeedCreated);
      socket.off("feedUpdated", handleFeedUpdated);
      socket.off("feedDeleted", handleFeedDeleted);
    };
  }, [isSuperadmin]);

  // ============================================================
  // SEARCH
  // ============================================================

  const filteredFeeds = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return feeds.filter((feed) => {
      if (!keyword) return true;

      return [
        feed.name,
        feed.supplier,
        feed.unit,
        feed.quantity,
        feed.pricePerUnit,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [feeds, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.ceil(filteredFeeds.length / ITEMS_PER_PAGE);

  const paginatedFeeds = filteredFeeds.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  // ============================================================
  // STATISTICS
  // ============================================================

  const totalFeedTypes = feeds.length;

  const totalQuantity = feeds.reduce(
    (sum, feed) => sum + getNumber(feed.quantity),
    0,
  );

  const lowStockCount = feeds.filter(isLowStock).length;

  const inventoryValue = feeds.reduce(
    (sum, feed) =>
      sum + getNumber(feed.quantity) * getNumber(feed.pricePerUnit),
    0,
  );

  const expiredCount = feeds.filter((feed) => {
    if (feed.isDeleted || !feed.expiryDate) return false;

    const days = daysUntilExpiry(feed.expiryDate);

    return days !== null && days < 0;
  }).length;

  const expiringCount = feeds.filter((feed) => {
    if (feed.isDeleted || !feed.expiryDate) return false;

    const days = daysUntilExpiry(feed.expiryDate);

    return days !== null && days >= 0 && days <= 7;
  }).length;

  // ============================================================
  // CHART DATA
  // IMPORTANT: QUANTITY CHART USES FILTERED FEEDS.
  // STOCK CHART USES THE ORIGINAL FEEDS ARRAY.
  // ============================================================

  const chartData = useMemo(
    () =>
      filteredFeeds.map((feed) => ({
        name: feed.name || "Unnamed",
        quantity: getNumber(feed.quantity),
        unit: feed.unit || "bags",
      })),
    [filteredFeeds],
  );

  const stockSummary = useMemo(() => {
    const low = feeds.filter(isLowStock).length;

    return [
      {
        name: "Low Stock",
        value: low,
      },
      {
        name: "Available",
        value: Math.max(0, feeds.length - low),
      },
    ];
  }, [feeds]);

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const validateFeed = (data) => {
    if (!data.name.trim()) {
      toast.error("Please enter the feed name.");
      return false;
    }

    const quantity = Number(data.quantity);
    const price = Number(data.pricePerUnit);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than zero.");
      return false;
    }

    if (!Number.isFinite(price) || price < 0) {
      toast.error("Please enter a valid price per unit.");
      return false;
    }

    if (!data.purchaseDate) {
      toast.error("Please select a purchase date.");
      return false;
    }

    if (
      data.expiryDate &&
      data.purchaseDate &&
      data.expiryDate < data.purchaseDate
    ) {
      toast.error("Expiry date cannot be earlier than purchase date.");
      return false;
    }

    return true;
  };

  // ============================================================
  // CREATE FEED
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateFeed(formData)) return;

    try {
      setSaving(true);

      await createFeed({
        ...formData,
        name: formData.name.trim(),
        supplier: formData.supplier.trim(),
        quantity: Number(formData.quantity),
        pricePerUnit: Number(formData.pricePerUnit),
        expiryDate: formData.expiryDate || null,
      });

      toast.success("Feed added successfully.");

      setFormData(createInitialForm());

      await loadFeeds();
    } catch (error) {
      console.error("Create feed error:", error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Unable to save feed inventory.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // EDIT FEED
  // ============================================================

  const openEditModal = (feed) => {
    if (!feed || feed.isDeleted) return;

    setEditingFeed(feed);

    setEditData({
      name: feed.name || "",
      quantity: feed.quantity ?? "",
      unit: feed.unit || "bags",
      pricePerUnit: feed.pricePerUnit ?? "",
      supplier: feed.supplier || "",
      purchaseDate: toDateInputValue(feed.purchaseDate),
      expiryDate: toDateInputValue(feed.expiryDate),
    });

    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (updating) return;

    setShowEditModal(false);
    setEditingFeed(null);
    setEditData(createInitialForm());
  };

  const handleUpdate = async (event) => {
    event.preventDefault();

    if (!editingFeed?._id || !validateFeed(editData)) return;

    try {
      setUpdating(true);

      await updateFeed(editingFeed._id, {
        ...editData,
        name: editData.name.trim(),
        supplier: editData.supplier.trim(),
        quantity: Number(editData.quantity),
        pricePerUnit: Number(editData.pricePerUnit),
        expiryDate: editData.expiryDate || null,
      });

      toast.success("Feed updated successfully.");

      setShowEditModal(false);
      setEditingFeed(null);

      await loadFeeds();
    } catch (error) {
      console.error("Update feed error:", error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Unable to update feed.",
      );
    } finally {
      setUpdating(false);
    }
  };

  // ============================================================
  // DELETE FEED
  // ============================================================

  const confirmDelete = (feed) => {
    if (!feed || feed.isDeleted) return;

    setSelectedFeed(feed);
    setShowDeleteModal(true);
  };

  const cancelDelete = () => {
    if (deleting) return;

    setSelectedFeed(null);
    setShowDeleteModal(false);
  };

  const handleDelete = async () => {
    if (!selectedFeed?._id || deleting) return;

    try {
      setDeleting(true);

      await deleteFeed(selectedFeed._id);

      toast.success("Feed deleted successfully.");

      setSelectedFeed(null);
      setShowDeleteModal(false);

      await loadFeeds();
    } catch (error) {
      console.error("Delete feed error:", error);

      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to delete feed.",
      );
    } finally {
      setDeleting(false);
    }
  };

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = async () => {
    const refreshed = await loadFeeds();

    if (refreshed) {
      toast.success("Inventory refreshed.");
    }
  };

  // ============================================================
  // EXPORT EXCEL
  // ============================================================

  const exportExcel = async () => {
    if (!filteredFeeds.length) {
      toast.info("There are no feed records to export.");
      return;
    }

    try {
      const XLSX = await import("xlsx");

      const worksheet = XLSX.utils.json_to_sheet(
        filteredFeeds.map((feed) => ({
          Feed: feed.name,
          Quantity: getNumber(feed.quantity),
          Unit: feed.unit || "bags",
          "Price Per Unit": getNumber(feed.pricePerUnit),
          Supplier: feed.supplier || "-",
          "Purchase Date": formatDate(feed.purchaseDate),
          "Expiry Date": formatDate(feed.expiryDate),
          Status: feed.isDeleted
            ? "Deleted"
            : isLowStock(feed)
              ? "Low Stock"
              : "In Stock",
        })),
      );

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(workbook, worksheet, "Feed Inventory");

      XLSX.writeFile(workbook, "FeedInventory.xlsx");

      toast.success("Excel exported successfully.");
    } catch (error) {
      console.error("Excel export error:", error);
      toast.error("Unable to export Excel file.");
    }
  };

  // ============================================================
  // EXPORT PDF
  // ============================================================

  const exportPDF = async () => {
    if (!filteredFeeds.length) {
      toast.info("There are no feed records to export.");
      return;
    }

    try {
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const jsPDF = jsPDFModule.default;
      const autoTable = autoTableModule.default;

      const doc = new jsPDF({
        orientation: "landscape",
      });

      doc.setFontSize(18);
      doc.setTextColor(48, 75, 55);
      doc.text("MEBREK FARMS", 14, 14);

      doc.setFontSize(12);
      doc.setTextColor(90, 90, 90);
      doc.text("Feed Inventory Report", 14, 22);

      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, 14, 28);

      autoTable(doc, {
        startY: 34,
        head: [
          [
            "Feed",
            "Quantity",
            "Price / Unit",
            "Supplier",
            "Purchased",
            "Expires",
            "Status",
          ],
        ],
        body: filteredFeeds.map((feed) => [
          feed.name || "-",
          `${getNumber(feed.quantity)} ${feed.unit || "bags"}`,
          formatCurrency(feed.pricePerUnit),
          feed.supplier || "-",
          formatDate(feed.purchaseDate),
          formatDate(feed.expiryDate),
          feed.isDeleted
            ? "Deleted"
            : isLowStock(feed)
              ? "Low Stock"
              : "In Stock",
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [82, 123, 88],
        },
        alternateRowStyles: {
          fillColor: [247, 249, 245],
        },
      });

      doc.save("FeedInventory.pdf");

      toast.success("PDF exported successfully.");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Unable to export PDF file.");
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-[#f5f7f3] p-4 sm:p-6 lg:p-8">
      {/* HEADER */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#71856e]">
            Farm Management / Store Management
          </p>

          <h1 className="text-2xl font-bold text-[#304b37] sm:text-3xl">
            Feed Inventory
          </h1>

          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Manage poultry feed stock, monitor expiry dates and track inventory
            value.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className="rounded-xl border border-[#d8e2d5] bg-white px-4 py-2.5 text-sm font-semibold text-[#426348] hover:bg-[#eef4ec]"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={exportPDF}
            className="rounded-xl border border-[#eadada] bg-white px-4 py-2.5 text-sm font-semibold text-[#a45d58] hover:bg-red-50"
          >
            Export PDF
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl bg-[#527b58] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#426748] disabled:opacity-60"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[#dce5d9] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Feed Types</p>
          <p className="mt-3 text-3xl font-bold text-[#426348]">
            {totalFeedTypes}
          </p>
          <p className="mt-1 text-xs text-gray-400">Recorded feed types</p>
        </div>

        <div className="rounded-2xl border border-[#dce3e9] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Quantity</p>
          <p className="mt-3 text-3xl font-bold text-[#6387a5]">
            {totalQuantity.toLocaleString("en-NG", {
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-xs text-gray-400">Combined quantities</p>
        </div>

        <div className="rounded-2xl border border-[#eadada] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Low Stock</p>
          <p className="mt-3 text-3xl font-bold text-[#b45353]">
            {lowStockCount}
          </p>
          <p className="mt-1 text-xs text-gray-400">Feeds needing attention</p>
        </div>

        <div className="rounded-2xl border border-[#e9e0d2] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Expiry Alerts</p>
          <p className="mt-3 text-3xl font-bold text-[#b77943]">
            {expiredCount + expiringCount}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {expiredCount} expired · {expiringCount} expiring soon
          </p>
        </div>

        <div className="rounded-2xl border border-[#e2dced] bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Inventory Value</p>
          <p className="mt-3 break-words text-2xl font-bold text-[#78618f]">
            {formatCurrency(inventoryValue)}
          </p>
          <p className="mt-1 text-xs text-gray-400">Estimated stock value</p>
        </div>
      </div>

      {/* EXPIRY ALERT */}
      {(expiredCount > 0 || expiringCount > 0) && (
        <div className="mb-8 rounded-xl border border-[#eadfca] bg-[#fffaf0] px-5 py-4">
          <h3 className="font-semibold text-[#8a6338]">Feed Expiry Alert</h3>

          <p className="mt-1 text-sm text-[#92734f]">
            {expiredCount > 0 &&
              `${expiredCount} feed record(s) have expired. `}
            {expiringCount > 0 &&
              `${expiringCount} feed record(s) will expire within 7 days.`}{" "}
            Please review these records.
          </p>
        </div>
      )}

      {/* ========================================================
          CHARTS
      ======================================================== */}
      <div className="mb-8 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
        {/* FEED QUANTITY */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#304b37]">Feed Quantity</h2>

          <p className="mb-5 mt-1 text-sm text-gray-500">
            Current quantity for each feed record.
          </p>

          {chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-xl bg-[#f8faf7] text-sm text-gray-400">
              No feed records available for the chart.
            </div>
          ) : (
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 15,
                    right: 15,
                    left: 5,
                    bottom: 40,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5eae2"
                  />

                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{ fontSize: 12, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals
                  />

                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} ${props.payload.unit}`,
                      "Quantity",
                    ]}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <Bar
                    dataKey="quantity"
                    name="Quantity"
                    radius={[6, 6, 0, 0]}
                    minPointSize={3}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={BAR_COLORS[index % BAR_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* STOCK STATUS */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#304b37]">Stock Status</h2>

          <p className="mb-5 mt-1 text-sm text-gray-500">
            Comparison of low-stock and available feed records.
          </p>

          {feeds.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-xl bg-[#f8faf7] text-sm text-gray-400">
              No feed records available for the chart.
            </div>
          ) : (
            <div className="h-[300px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockSummary}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={95}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="#b96b65" />
                    <Cell fill="#638b68" />
                  </Pie>

                  <Tooltip />

                  <Legend verticalAlign="bottom" height={30} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* SEARCH */}
      <div className="mb-6 rounded-2xl border border-[#e1e8dd] bg-white p-4 shadow-sm">
        <label
          htmlFor="feedSearch"
          className="mb-2 block text-sm font-semibold text-gray-700"
        >
          Search Feed Inventory
        </label>

        <input
          id="feedSearch"
          type="search"
          placeholder="Search by feed name, supplier, quantity or unit..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879] focus:ring-2 focus:ring-[#779879]/20"
        />
      </div>

      {/* ADD FEED */}
      <div className="mb-8 rounded-2xl border border-[#e1e8dd] bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#304b37]">
            Add Feed Inventory
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Record new feed purchases and update farm stock.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Feed Name *
            </label>

            <input
              type="text"
              name="name"
              placeholder="Enter feed name"
              value={formData.name}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Quantity *
            </label>

            <input
              type="number"
              name="quantity"
              min="0.01"
              step="any"
              placeholder="Enter quantity"
              value={formData.quantity}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Unit *
            </label>

            <select
              name="unit"
              value={formData.unit}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#779879]"
              required
            >
              {FEED_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Price Per Unit (₦) *
            </label>

            <input
              type="number"
              name="pricePerUnit"
              min="0"
              step="0.01"
              placeholder="Enter price per unit"
              value={formData.pricePerUnit}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Supplier
            </label>

            <input
              type="text"
              name="supplier"
              placeholder="Enter supplier name"
              value={formData.supplier}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Purchase Date *
            </label>

            <input
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Expiry Date (Optional)
            </label>

            <input
              type="date"
              name="expiryDate"
              min={formData.purchaseDate || undefined}
              value={formData.expiryDate}
              onChange={handleFormChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879] md:max-w-[calc(50%-0.625rem)]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#527b58] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#426748] disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
          >
            {saving ? "Saving Feed..." : "Add Feed to Inventory"}
          </button>
        </form>
      </div>

      {/* INVENTORY TABLE */}
      {loading ? (
        <div className="rounded-2xl border border-[#e1e8dd] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#dce8d9] border-t-[#527b58]" />

          <p className="text-sm text-gray-500">Loading feed inventory...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e1e8dd] bg-white shadow-sm">
          <div className="border-b border-gray-100 p-5">
            <h2 className="text-xl font-bold text-[#304b37]">
              Feed Inventory Records
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {filteredFeeds.length} record(s) found.
            </p>
          </div>

          {filteredFeeds.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <h3 className="text-lg font-semibold text-gray-600">
                No Feed Records Found
              </h3>

              <p className="mt-2 text-sm text-gray-400">
                {search
                  ? "Try another search term."
                  : "Add your first feed inventory record."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead>
                  <tr className="border-b border-[#e5eae2] bg-[#f1f5ef] text-xs uppercase tracking-wide text-gray-600">
                    <th className="px-4 py-4">Feed</th>
                    <th className="px-4 py-4">Quantity</th>
                    <th className="px-4 py-4">Price / Unit</th>
                    <th className="px-4 py-4">Supplier</th>
                    <th className="px-4 py-4">Purchased</th>
                    <th className="px-4 py-4">Expires</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedFeeds.map((feed) => {
                    const daysLeft = daysUntilExpiry(feed.expiryDate);

                    const isExpired = daysLeft !== null && daysLeft < 0;

                    const isExpiringSoon =
                      daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

                    return (
                      <tr
                        key={feed._id}
                        className={`border-b border-gray-100 transition hover:bg-[#fafbf8] ${
                          feed.isDeleted ? "bg-gray-50" : ""
                        }`}
                      >
                        <td className="px-4 py-4 font-semibold text-gray-700">
                          {feed.name || "-"}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          {getNumber(feed.quantity).toLocaleString("en-NG", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          {feed.unit || "bags"}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          {formatCurrency(feed.pricePerUnit)}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {feed.supplier || "-"}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(feed.purchaseDate)}
                        </td>

                        <td className="px-4 py-4 text-sm">
                          {!feed.expiryDate ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <div>
                              <span
                                className={
                                  isExpired
                                    ? "font-semibold text-red-600"
                                    : isExpiringSoon
                                      ? "font-semibold text-orange-600"
                                      : "text-gray-600"
                                }
                              >
                                {formatDate(feed.expiryDate)}
                              </span>

                              {isExpired && (
                                <p className="mt-1 text-xs font-semibold text-red-600">
                                  Expired
                                </p>
                              )}

                              {isExpiringSoon && (
                                <p className="mt-1 text-xs font-semibold text-orange-600">
                                  {daysLeft === 0
                                    ? "Expires today"
                                    : `${daysLeft} day(s) left`}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {feed.isDeleted ? (
                            <span className="inline-flex rounded-full bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                              Deleted
                              {feed.deletedBy ? ` by ${feed.deletedBy}` : ""}
                              {feed.deletedByRole
                                ? ` (${feed.deletedByRole})`
                                : ""}
                            </span>
                          ) : isLowStock(feed) ? (
                            <span className="inline-flex rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                              In Stock
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {!feed.isDeleted && (
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(feed)}
                                className="rounded-lg border border-[#d8e2d5] bg-[#f1f5ef] px-3 py-2 text-xs font-semibold text-[#426348] hover:bg-[#e4eee1]"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => confirmDelete(feed)}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* PAGINATION */}
          {filteredFeeds.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(page * ITEMS_PER_PAGE, filteredFeeds.length)} of{" "}
                {filteredFeeds.length} records
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage((previous) => Math.max(1, previous - 1))
                  }
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages || 1}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((previous) => Math.min(totalPages, previous + 1))
                  }
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingFeed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal();
          }}
        >
          <div className="my-auto w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <h2 className="mb-6 text-xl font-bold text-[#304b37]">
              Edit Feed Inventory
            </h2>

            <form onSubmit={handleUpdate} className="grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Feed Name
                </label>

                <input
                  name="name"
                  value={editData.name}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Quantity
                  </label>

                  <input
                    type="number"
                    name="quantity"
                    min="0.01"
                    step="any"
                    value={editData.quantity}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Unit
                  </label>

                  <select
                    name="unit"
                    value={editData.unit}
                    onChange={handleEditChange}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#779879]"
                    required
                  >
                    {FEED_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Price Per Unit (₦)
                </label>

                <input
                  type="number"
                  name="pricePerUnit"
                  min="0"
                  step="0.01"
                  value={editData.pricePerUnit}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Supplier
                </label>

                <input
                  name="supplier"
                  value={editData.supplier}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Purchase Date
                </label>

                <input
                  type="date"
                  name="purchaseDate"
                  value={editData.purchaseDate}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Expiry Date (Optional)
                </label>

                <input
                  type="date"
                  name="expiryDate"
                  min={editData.purchaseDate || undefined}
                  value={editData.expiryDate}
                  onChange={handleEditChange}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#779879]"
                />
              </div>

              <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={updating}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updating}
                  className="rounded-xl bg-[#527b58] px-5 py-3 text-sm font-semibold text-white hover:bg-[#426748] disabled:opacity-50"
                >
                  {updating ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {showDeleteModal && selectedFeed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelDelete();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-xl">
              🗑️
            </div>

            <h2 className="text-xl font-bold text-[#304b37]">Delete Feed</h2>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              Are you sure you want to delete{" "}
              <strong className="text-gray-800">{selectedFeed.name}</strong>?
              This will remove it from the active inventory.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-[#b45353] px-5 py-3 text-sm font-semibold text-white hover:bg-[#963f3f] disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
