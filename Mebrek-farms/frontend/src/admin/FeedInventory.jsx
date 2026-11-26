import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  fetchFeeds,
  createFeed,
  updateFeed,
  deleteFeed,
  adjustFeedStock,
  submitFeedChangeRequest,
  fetchFeedChangeRequests,
  reviewFeedChangeRequest,
} from "../services/feedService";

import socket from "../services/socket";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// ============================================================
// CONSTANTS
// ============================================================

const ITEMS_PER_PAGE = 10;

const UNITS = ["bags", "kg", "tonnes"];

const CHART_COLORS = ["#16a34a", "#eab308", "#3b82f6", "#f97316", "#8b5cf6"];

const EMPTY_FEED_FORM = {
  name: "",
  quantity: "",
  stockAdjustment: "",
  stockAdjustmentDirection: "add",
  unit: "bags",
  supplier: "",
  lowStockThreshold: 5,
  purchaseDate: new Date().toISOString().slice(0, 10),
  expiryDate: "",
};

// ============================================================
// HELPERS
// ============================================================

const getRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    return String(user.role || localStorage.getItem("role") || "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");
  } catch {
    return String(localStorage.getItem("role") || "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");
  }
};

const extractFeeds = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.feeds)) return response.feeds;

  if (Array.isArray(response?.data?.feeds)) return response.data.feeds;

  if (Array.isArray(response?.data)) return response.data;

  return [];
};

const extractRequests = (response) => {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.requests)) return response.requests;

  if (Array.isArray(response?.data?.requests)) return response.data.requests;

  if (Array.isArray(response?.data)) return response.data;

  return [];
};

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

const dateInputValue = (date) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "";

  return parsed.toISOString().slice(0, 10);
};

const getFeedStatus = (feed) => {
  if (feed.isDeleted) {
    return {
      label: "Deleted",
      className: "bg-gray-100 text-gray-600",
    };
  }

  const quantity = Number(feed.quantity || 0);
  const threshold = Number(feed.lowStockThreshold ?? 5);

  if (quantity <= 0) {
    return {
      label: "Out of Stock",
      className: "bg-red-100 text-red-700",
    };
  }

  if (quantity <= threshold) {
    return {
      label: "Low Stock",
      className: "bg-amber-100 text-amber-700",
    };
  }

  return {
    label: "In Stock",
    className: "bg-green-100 text-green-700",
  };
};

const getExpiryStatus = (feed) => {
  if (!feed.expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(feed.expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (Number.isNaN(expiry.getTime())) return null;

  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);

  if (days < 0) {
    return {
      label: "Expired",
      className: "bg-red-100 text-red-700",
      days,
    };
  }

  if (days <= 30) {
    return {
      label: "Expiring Soon",
      className: "bg-amber-100 text-amber-700",
      days,
    };
  }

  return {
    label: "Valid",
    className: "bg-green-100 text-green-700",
    days,
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const getRequestFeedName = (request) => {
  if (request.feed && typeof request.feed === "object") {
    return request.feed.name || "Unknown feed";
  }

  return "Feed record";
};

const getRequestSummary = (request) => {
  const changes = request.requestedChanges || {};

  if (request.requestType === "STOCK_ADJUSTMENT") {
    const rawQuantity = Number(changes.quantity || 0);

    // Support older requests that stored direction separately.
    const adjustment = changes.direction
      ? changes.direction === "remove"
        ? -Math.abs(rawQuantity)
        : Math.abs(rawQuantity)
      : rawQuantity;

    const direction = adjustment >= 0 ? "Add" : "Remove";

    return `${direction} ${Math.abs(adjustment)} ${
      request.feed?.unit || "units"
    }`;
  }

  return Object.entries(changes)
    .map(([key, value]) => {
      const readableKey = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (letter) => letter.toUpperCase());

      return `${readableKey}: ${value || "—"}`;
    })
    .join(", ");
};

// ============================================================
// SMALL UI COMPONENTS
// ============================================================

const StatCard = ({ title, value, description, icon, color }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        {description && (
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        )}
      </div>

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${color}`}
      >
        {icon}
      </div>
    </div>
  </div>
);

const Modal = ({ title, children, onClose, wide = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
    <div
      className={`my-6 w-full rounded-2xl bg-white shadow-2xl ${
        wide ? "max-w-3xl" : "max-w-xl"
      }`}
    >
      <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b bg-white px-6 py-4">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100"
        >
          ×
        </button>
      </div>

      <div className="p-6">{children}</div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const normalized = String(status || "").toUpperCase();

  const styles = {
    PENDING: "bg-amber-100 text-amber-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        styles[normalized] || "bg-gray-100 text-gray-700"
      }`}
    >
      {normalized || "UNKNOWN"}
    </span>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

const FeedInventory = () => {
  const role = getRole();

  const isSuperadmin = role === "superadmin";
  const isManager = role === "manager";

  const canAccessInventory = isSuperadmin || isManager;

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [feeds, setFeeds] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [requestFilter, setRequestFilter] = useState("ALL");

  const [showFeedModal, setShowFeedModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [editingFeed, setEditingFeed] = useState(null);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("APPROVED");

  const [feedForm, setFeedForm] = useState(EMPTY_FEED_FORM);

  const [requestRemarks, setRequestRemarks] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");

  // ----------------------------------------------------------
  // DERIVED EDIT STOCK VALUES
  // ----------------------------------------------------------

  const editAdjustmentQuantity =
    feedForm.stockAdjustment === "" ? 0 : Number(feedForm.stockAdjustment);

  const editCurrentStock = Number(editingFeed?.quantity || 0);

  const editSignedAdjustment =
    feedForm.stockAdjustmentDirection === "remove"
      ? -editAdjustmentQuantity
      : editAdjustmentQuantity;

  const editProjectedStock = editCurrentStock + editSignedAdjustment;

  const hasEditStockAdjustment =
    editingFeed !== null && feedForm.stockAdjustment !== "";

  // ----------------------------------------------------------
  // LOAD INVENTORY
  // ----------------------------------------------------------

  const loadFeeds = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);

    try {
      const response = await fetchFeeds();
      setFeeds(extractFeeds(response));
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load feed inventory."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------
  // LOAD REQUESTS
  // ----------------------------------------------------------

  const loadRequests = useCallback(async () => {
    try {
      const response = await fetchFeedChangeRequests();
      setRequests(extractRequests(response));
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to load feed requests."));
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadFeeds(true), loadRequests()]);
  }, [loadFeeds, loadRequests]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ----------------------------------------------------------
  // SOCKET.IO
  // ----------------------------------------------------------

  useEffect(() => {
    if (!socket) return undefined;

    const handleFeedChange = () => {
      loadFeeds(false);
    };

    const handleRequestChange = () => {
      loadRequests();
    };

    socket.on("feedCreated", handleFeedChange);
    socket.on("feedUpdated", handleFeedChange);
    socket.on("feedDeleted", handleFeedChange);

    socket.on("feedChangeRequestCreated", handleRequestChange);
    socket.on("feedChangeRequestReviewed", handleRequestChange);

    return () => {
      socket.off("feedCreated", handleFeedChange);
      socket.off("feedUpdated", handleFeedChange);
      socket.off("feedDeleted", handleFeedChange);

      socket.off("feedChangeRequestCreated", handleRequestChange);
      socket.off("feedChangeRequestReviewed", handleRequestChange);
    };
  }, [loadFeeds, loadRequests]);

  // ----------------------------------------------------------
  // STATISTICS
  // ----------------------------------------------------------

  const activeFeeds = useMemo(
    () => feeds.filter((feed) => !feed.isDeleted),
    [feeds],
  );

  const totalQuantity = useMemo(
    () =>
      activeFeeds.reduce(
        (total, feed) => total + Number(feed.quantity || 0),
        0,
      ),
    [activeFeeds],
  );

  const lowStockCount = useMemo(
    () =>
      activeFeeds.filter(
        (feed) =>
          Number(feed.quantity || 0) <= Number(feed.lowStockThreshold ?? 5),
      ).length,
    [activeFeeds],
  );

  const expiredCount = useMemo(
    () =>
      activeFeeds.filter((feed) => getExpiryStatus(feed)?.label === "Expired")
        .length,
    [activeFeeds],
  );

  const expiringCount = useMemo(
    () =>
      activeFeeds.filter(
        (feed) => getExpiryStatus(feed)?.label === "Expiring Soon",
      ).length,
    [activeFeeds],
  );

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "PENDING").length,
    [requests],
  );

  // ----------------------------------------------------------
  // CHART DATA
  // ----------------------------------------------------------

  const quantityChartData = useMemo(
    () =>
      [...activeFeeds]
        .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
        .slice(0, 8)
        .map((feed) => ({
          name:
            feed.name?.length > 15 ? `${feed.name.slice(0, 15)}...` : feed.name,
          quantity: Number(feed.quantity || 0),
        })),
    [activeFeeds],
  );

  const stockStatusData = useMemo(
    () =>
      [
        {
          name: "In Stock",
          value: activeFeeds.filter(
            (feed) => getFeedStatus(feed).label === "In Stock",
          ).length,
        },
        {
          name: "Low Stock",
          value: activeFeeds.filter(
            (feed) => getFeedStatus(feed).label === "Low Stock",
          ).length,
        },
        {
          name: "Out of Stock",
          value: activeFeeds.filter(
            (feed) => getFeedStatus(feed).label === "Out of Stock",
          ).length,
        },
      ].filter((item) => item.value > 0),
    [activeFeeds],
  );

  // ----------------------------------------------------------
  // SEARCH AND PAGINATION
  // ----------------------------------------------------------

  const filteredFeeds = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return feeds.filter((feed) => {
      if (!isSuperadmin && feed.isDeleted) return false;

      if (!keyword) return true;

      return [feed.name, feed.supplier, feed.unit, feed.quantity].some(
        (value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(keyword),
      );
    });
  }, [feeds, search, isSuperadmin]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredFeeds.length / ITEMS_PER_PAGE),
  );

  const paginatedFeeds = filteredFeeds.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const filteredRequests = useMemo(() => {
    if (requestFilter === "ALL") return requests;

    return requests.filter((request) => request.status === requestFilter);
  }, [requests, requestFilter]);

  // ----------------------------------------------------------
  // FEED FORM
  // ----------------------------------------------------------

  const openCreateModal = () => {
    if (!canAccessInventory) {
      toast.error("You are not authorised to create feed records.");
      return;
    }

    setEditingFeed(null);
    setFeedForm({ ...EMPTY_FEED_FORM });
    setRequestRemarks("");
    setShowFeedModal(true);
  };

  const openEditModal = (feed) => {
    if (!feed || feed.isDeleted) return;

    setEditingFeed(feed);

    setFeedForm({
      name: feed.name || "",
      quantity: "",
      stockAdjustment: "",
      stockAdjustmentDirection: "add",
      unit: feed.unit || "bags",
      supplier: feed.supplier || "",
      lowStockThreshold: feed.lowStockThreshold ?? 5,
      purchaseDate: dateInputValue(feed.purchaseDate),
      expiryDate: dateInputValue(feed.expiryDate),
    });

    setRequestRemarks("");
    setShowFeedModal(true);
  };

  const handleFeedFormChange = (event) => {
    const { name, value } = event.target;

    setFeedForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const hasFeedDetailChanges = () => {
    if (!editingFeed) return false;

    const original = {
      name: editingFeed.name || "",
      unit: editingFeed.unit || "bags",
      supplier: editingFeed.supplier || "",
      lowStockThreshold: Number(editingFeed.lowStockThreshold ?? 5),
      purchaseDate: dateInputValue(editingFeed.purchaseDate) || "",
      expiryDate: dateInputValue(editingFeed.expiryDate) || "",
    };

    const updated = {
      name: feedForm.name.trim(),
      unit: feedForm.unit,
      supplier: feedForm.supplier.trim(),
      lowStockThreshold: Number(feedForm.lowStockThreshold),
      purchaseDate: feedForm.purchaseDate || "",
      expiryDate: feedForm.expiryDate || "",
    };

    return Object.keys(original).some(
      (key) => String(original[key]) !== String(updated[key]),
    );
  };

  const validateFeedForm = () => {
    if (!feedForm.name.trim()) {
      toast.error("Feed name is required.");
      return false;
    }

    if (
      !editingFeed &&
      (feedForm.quantity === "" ||
        !Number.isFinite(Number(feedForm.quantity)) ||
        Number(feedForm.quantity) < 0)
    ) {
      toast.error("Enter a valid opening quantity.");
      return false;
    }

    if (
      feedForm.lowStockThreshold === "" ||
      !Number.isFinite(Number(feedForm.lowStockThreshold)) ||
      Number(feedForm.lowStockThreshold) < 0
    ) {
      toast.error("Enter a valid low stock threshold.");
      return false;
    }

    if (editingFeed && hasEditStockAdjustment) {
      if (
        !Number.isFinite(editAdjustmentQuantity) ||
        editAdjustmentQuantity <= 0
      ) {
        toast.error("Enter a stock adjustment quantity greater than zero.");
        return false;
      }

      if (
        feedForm.stockAdjustmentDirection === "remove" &&
        editAdjustmentQuantity > editCurrentStock
      ) {
        toast.error(
          `You cannot remove more than the current stock of ${editCurrentStock} ${editingFeed.unit}.`,
        );
        return false;
      }

      if (
        feedForm.stockAdjustmentDirection === "remove" &&
        !requestRemarks.trim()
      ) {
        toast.error("Please provide a reason for reducing feed stock.");
        return false;
      }
    }

    if (editingFeed && isManager) {
      const hasDetails = hasFeedDetailChanges();

      if (!hasDetails && !hasEditStockAdjustment) {
        toast.error("You have not made any changes.");
        return false;
      }

      if (!requestRemarks.trim()) {
        toast.error("Please provide a reason for your requested changes.");
        return false;
      }
    }

    if (
      editingFeed &&
      isSuperadmin &&
      !hasFeedDetailChanges() &&
      !hasEditStockAdjustment
    ) {
      toast.info("You have not made any changes.");
      return false;
    }

    return true;
  };

  const handleFeedSubmit = async (event) => {
    event.preventDefault();

    if (!canAccessInventory) {
      toast.error("You are not authorised to perform this action.");
      return;
    }

    if (!validateFeedForm()) return;

    setSaving(true);

    try {
      // ------------------------------------------------------
      // CREATE NEW FEED
      // ------------------------------------------------------

      if (!editingFeed) {
        await createFeed({
          name: feedForm.name.trim(),
          quantity: Number(feedForm.quantity),
          unit: feedForm.unit,
          supplier: feedForm.supplier.trim(),
          lowStockThreshold: Number(feedForm.lowStockThreshold),
          purchaseDate: feedForm.purchaseDate || null,
          expiryDate: feedForm.expiryDate || null,
        });

        toast.success("Feed inventory record created successfully.");
      } else {
        // ----------------------------------------------------
        // EXISTING FEED
        // ----------------------------------------------------

        const details = {
          name: feedForm.name.trim(),
          unit: feedForm.unit,
          supplier: feedForm.supplier.trim(),
          lowStockThreshold: Number(feedForm.lowStockThreshold),
          purchaseDate: feedForm.purchaseDate || null,
          expiryDate: feedForm.expiryDate || null,
        };

        const hasDetails = hasFeedDetailChanges();
        const hasStockAdjustment = hasEditStockAdjustment;

        const signedAdjustment =
          feedForm.stockAdjustmentDirection === "remove"
            ? -editAdjustmentQuantity
            : editAdjustmentQuantity;

        // ----------------------------------------------------
        // SUPERADMIN: DIRECT UPDATES
        // ----------------------------------------------------

        if (isSuperadmin) {
          if (hasDetails) {
            await updateFeed(editingFeed._id, details);
          }

          if (hasStockAdjustment) {
            await adjustFeedStock(editingFeed._id, {
              quantity: signedAdjustment,
              remarks: requestRemarks.trim(),
            });
          }

          if (hasDetails && hasStockAdjustment) {
            toast.success(
              "Feed details and stock quantity updated successfully.",
            );
          } else if (hasDetails) {
            toast.success("Feed details updated successfully.");
          } else {
            toast.success("Feed stock adjusted successfully.");
          }
        } else {
          // --------------------------------------------------
          // MANAGER: SUBMIT REQUESTS FOR APPROVAL
          // --------------------------------------------------

          let detailRequestSubmitted = false;
          let stockRequestSubmitted = false;

          if (hasDetails) {
            await submitFeedChangeRequest(editingFeed._id, {
              requestType: "DETAILS_UPDATE",
              requestedChanges: details,
              requestRemarks: requestRemarks.trim(),
            });

            detailRequestSubmitted = true;
          }

          if (hasStockAdjustment) {
            await submitFeedChangeRequest(editingFeed._id, {
              requestType: "STOCK_ADJUSTMENT",
              requestedChanges: {
                quantity: signedAdjustment,
              },
              requestRemarks: requestRemarks.trim(),
            });

            stockRequestSubmitted = true;
          }

          if (detailRequestSubmitted && stockRequestSubmitted) {
            toast.success(
              "Your feed detail and stock adjustment requests have been submitted for approval.",
            );
          } else if (detailRequestSubmitted) {
            toast.success(
              "Your feed detail-change request has been submitted.",
            );
          } else if (stockRequestSubmitted) {
            toast.success("Your stock-adjustment request has been submitted.");
          }
        }
      }

      setShowFeedModal(false);
      setEditingFeed(null);
      setFeedForm({ ...EMPTY_FEED_FORM });
      setRequestRemarks("");

      await Promise.all([loadFeeds(false), loadRequests()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to save feed changes."));
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // DELETE FEED
  // ----------------------------------------------------------

  const openDeleteModal = (feed) => {
    if (!isSuperadmin) {
      toast.error("Only the superadmin can delete feed records.");
      return;
    }

    setSelectedFeed(feed);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedFeed || !isSuperadmin) return;

    setSaving(true);

    try {
      await deleteFeed(selectedFeed._id);

      toast.success("Feed record deleted successfully.");

      setShowDeleteModal(false);
      setSelectedFeed(null);

      await loadFeeds(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to delete feed record."));
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------------------------------------
  // REVIEW REQUEST
  // ----------------------------------------------------------

  const openReviewModal = (request, decision) => {
    if (!isSuperadmin) return;

    setSelectedRequest(request);
    setReviewDecision(decision);
    setReviewRemarks("");
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!selectedRequest || !isSuperadmin) return;

    setReviewingId(selectedRequest._id);

    try {
      await reviewFeedChangeRequest(selectedRequest._id, {
        decision: reviewDecision,
        reviewRemarks: reviewRemarks.trim(),
      });

      toast.success(
        reviewDecision === "APPROVED"
          ? "Request approved and applied successfully."
          : "Request rejected.",
      );

      setShowReviewModal(false);
      setSelectedRequest(null);

      await Promise.all([loadFeeds(false), loadRequests()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to review this request."));
    } finally {
      setReviewingId(null);
    }
  };

  // ----------------------------------------------------------
  // EXPORT TO EXCEL
  // ----------------------------------------------------------

  const exportExcel = () => {
    if (!filteredFeeds.length) {
      toast.info("There are no feed records to export.");
      return;
    }

    const rows = filteredFeeds.map((feed) => ({
      "Feed Name": feed.name,
      Quantity: feed.quantity,
      Unit: feed.unit,
      Supplier: feed.supplier || "",
      "Low Stock Threshold": feed.lowStockThreshold ?? 5,
      "Purchase Date": formatDate(feed.purchaseDate),
      "Expiry Date": formatDate(feed.expiryDate),
      Status: getFeedStatus(feed).label,
      "Deleted Record": feed.isDeleted ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Feed Inventory");

    XLSX.writeFile(workbook, "Mebrek_Farms_Feed_Inventory.xlsx");
  };

  // ----------------------------------------------------------
  // EXPORT TO PDF
  // ----------------------------------------------------------

  const exportPDF = () => {
    if (!filteredFeeds.length) {
      toast.info("There are no feed records to export.");
      return;
    }

    const doc = new jsPDF("landscape");

    doc.setFontSize(18);
    doc.text("MEBREK FARMS", 14, 15);

    doc.setFontSize(12);
    doc.text("Feed Inventory Report", 14, 23);

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, 14, 30);

    autoTable(doc, {
      startY: 36,
      head: [
        [
          "Feed",
          "Quantity",
          "Unit",
          "Supplier",
          "Threshold",
          "Purchased",
          "Expires",
          "Status",
        ],
      ],
      body: filteredFeeds.map((feed) => [
        feed.name || "—",
        feed.quantity ?? 0,
        feed.unit || "—",
        feed.supplier || "—",
        feed.lowStockThreshold ?? 5,
        formatDate(feed.purchaseDate),
        formatDate(feed.expiryDate),
        getFeedStatus(feed).label,
      ]),
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [47, 133, 90],
      },
    });

    doc.save("Mebrek_Farms_Feed_Inventory.pdf");
  };

  // ----------------------------------------------------------
  // ACCESS CONTROL
  // ----------------------------------------------------------

  if (!canAccessInventory) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        You are not authorised to access Feed Inventory.
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="space-y-6 pb-10">
      {/* HEADER */}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feed Inventory</h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage poultry feed stock, monitor stock levels and track expiry
            dates.
          </p>

          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-green-700">
            {isSuperadmin
              ? "Superadmin inventory management"
              : "Manager inventory access"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportExcel}
            className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
          >
            Export Excel
          </button>

          <button
            type="button"
            onClick={exportPDF}
            className="rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Export PDF
          </button>

          <button
            type="button"
            onClick={refreshAll}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
          >
            + Add Feed
          </button>
        </div>
      </div>

      {/* STATISTICS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Feed Types"
          value={activeFeeds.length}
          description="Active feed records"
          icon="🌾"
          color="bg-green-100"
        />

        <StatCard
          title="Total Quantity"
          value={totalQuantity.toLocaleString()}
          description="Combined inventory quantity"
          icon="📦"
          color="bg-blue-100"
        />

        <StatCard
          title="Low Stock"
          value={lowStockCount}
          description="At or below threshold"
          icon="⚠️"
          color="bg-amber-100"
        />

        <StatCard
          title="Expiry Alerts"
          value={expiredCount + expiringCount}
          description={`${expiredCount} expired · ${expiringCount} expiring soon`}
          icon="📅"
          color="bg-red-100"
        />

        <StatCard
          title="Pending Requests"
          value={pendingCount}
          description={
            isSuperadmin ? "Awaiting your review" : "Awaiting superadmin review"
          }
          icon="📨"
          color="bg-purple-100"
        />
      </div>

      {/* EXPIRY ALERT */}

      {(expiredCount > 0 || expiringCount > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-900">Feed Expiry Alert</h3>

          <p className="mt-1 text-sm text-amber-800">
            {expiredCount > 0 &&
              `${expiredCount} feed record(s) have expired. `}
            {expiringCount > 0 &&
              `${expiringCount} feed record(s) will expire within 30 days.`}
          </p>
        </div>
      )}

      {/* CHARTS */}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-gray-800">
            Feed Quantity Overview
          </h3>

          {quantityChartData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No feed records available.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={quantityChartData}
                  margin={{
                    top: 10,
                    right: 15,
                    left: 0,
                    bottom: 35,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tick={{ fontSize: 11 }}
                  />

                  <YAxis />

                  <Tooltip />

                  <Bar
                    dataKey="quantity"
                    fill="#2f855a"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-gray-800">
            Stock Status Distribution
          </h3>

          {stockStatusData.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              No stock data available.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockStatusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    label
                  >
                    {stockStatusData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* INVENTORY TABLE */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              Feed Inventory Records
            </h2>

            <p className="text-sm text-gray-500">
              {filteredFeeds.length} record(s) found
            </p>
          </div>

          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search feed, supplier or quantity..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-green-600 sm:max-w-xs"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading feed inventory...
          </div>
        ) : paginatedFeeds.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No feed inventory records found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Feed</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Purchased</th>
                    <th className="px-5 py-4">Expires</th>
                    <th className="px-5 py-4">Stock Status</th>
                    <th className="px-5 py-4">Expiry Status</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {paginatedFeeds.map((feed) => {
                    const status = getFeedStatus(feed);
                    const expiry = getExpiryStatus(feed);

                    return (
                      <tr key={feed._id} className="hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-gray-800">
                            {feed.name}
                          </div>

                          <div className="text-xs text-gray-400">
                            Threshold: {feed.lowStockThreshold ?? 5} {feed.unit}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-gray-800">
                          {Number(feed.quantity || 0).toLocaleString()}{" "}
                          {feed.unit}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {feed.supplier || "—"}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(feed.purchaseDate)}
                        </td>

                        <td className="px-5 py-4 text-gray-600">
                          {formatDate(feed.expiryDate)}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {expiry ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${expiry.className}`}
                            >
                              {expiry.label}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {!feed.isDeleted ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(feed)}
                                className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                              >
                                {isSuperadmin ? "Edit" : "Request Edit"}
                              </button>

                              {isSuperadmin && (
                                <button
                                  type="button"
                                  onClick={() => openDeleteModal(feed)}
                                  className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Deleted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="flex flex-col justify-between gap-3 border-t px-5 py-4 sm:flex-row sm:items-center">
              <p className="text-sm text-gray-500">
                Showing{" "}
                {filteredFeeds.length === 0
                  ? 0
                  : (page - 1) * ITEMS_PER_PAGE + 1}{" "}
                to {Math.min(page * ITEMS_PER_PAGE, filteredFeeds.length)} of{" "}
                {filteredFeeds.length}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ======================================================
          CHANGE REQUESTS

          The entire section is hidden when there are no
          submitted requests. Existing request history remains
          visible whenever at least one request exists.
      ====================================================== */}

      {requests.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                Feed Change Requests
              </h2>

              <p className="text-sm text-gray-500">
                {isSuperadmin
                  ? "Review and process manager requests."
                  : "Track the status of your submitted requests."}
              </p>
            </div>

            <select
              value={requestFilter}
              onChange={(event) => setRequestFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="ALL">All Requests</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No feed change requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Feed</th>
                    <th className="px-5 py-4">Request Type</th>
                    <th className="px-5 py-4">Requested Change</th>
                    <th className="px-5 py-4">Requested By</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Review</th>
                    {isSuperadmin && <th className="px-5 py-4">Actions</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.map((request) => (
                    <tr key={request._id}>
                      <td className="px-5 py-4 font-semibold text-gray-800">
                        {getRequestFeedName(request)}
                      </td>

                      <td className="px-5 py-4">
                        {request.requestType === "STOCK_ADJUSTMENT"
                          ? "Stock Adjustment"
                          : "Details Update"}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-gray-600">
                        <div className="break-words">
                          {getRequestSummary(request)}
                        </div>

                        {request.requestRemarks && (
                          <p className="mt-1 text-xs text-gray-400">
                            Note: {request.requestRemarks}
                          </p>
                        )}

                        {request.stockBefore !== null &&
                          request.stockBefore !== undefined &&
                          request.stockAfter !== null &&
                          request.stockAfter !== undefined && (
                            <p className="mt-1 text-xs font-medium text-green-700">
                              Stock: {request.stockBefore} →{" "}
                              {request.stockAfter}
                            </p>
                          )}
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {request.requestedBy?.name ||
                          request.requestedBy?.email ||
                          "Manager"}
                      </td>

                      <td className="px-5 py-4 text-gray-600">
                        {formatDate(request.createdAt)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={request.status} />
                      </td>

                      <td className="max-w-xs px-5 py-4 text-gray-600">
                        {request.reviewRemarks || "—"}

                        {request.reviewedAt && (
                          <p className="mt-1 text-xs text-gray-400">
                            {formatDate(request.reviewedAt)}
                          </p>
                        )}
                      </td>

                      {isSuperadmin && (
                        <td className="px-5 py-4">
                          {request.status === "PENDING" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openReviewModal(request, "APPROVED")
                                }
                                className="rounded-md bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200"
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openReviewModal(request, "REJECTED")
                                }
                                className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Reviewed
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT / REQUEST MODAL */}

      {showFeedModal && (
        <Modal
          title={
            !editingFeed
              ? "Add Feed Inventory"
              : isSuperadmin
                ? "Edit Feed Details and Stock"
                : "Request Feed Changes"
          }
          onClose={() => {
            if (!saving) setShowFeedModal(false);
          }}
        >
          <form onSubmit={handleFeedSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Feed Name *
              </label>

              <input
                name="name"
                value={feedForm.name}
                onChange={handleFeedFormChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                placeholder="e.g. Layers Mash"
              />
            </div>

            {/* OPENING QUANTITY FOR NEW FEED */}

            {!editingFeed && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Opening Quantity *
                </label>

                <input
                  type="number"
                  min="0"
                  step="any"
                  name="quantity"
                  value={feedForm.quantity}
                  onChange={handleFeedFormChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                  placeholder="Enter opening stock quantity"
                />
              </div>
            )}

            {/* STOCK ADJUSTMENT DURING EDIT */}

            {editingFeed && (
              <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-4">
                <div>
                  <h4 className="font-bold text-green-900">
                    Adjust Feed Quantity
                  </h4>

                  <p className="mt-1 text-sm text-green-800">
                    Current stock:{" "}
                    <strong>
                      {editCurrentStock.toLocaleString()} {editingFeed.unit}
                    </strong>
                  </p>

                  <p className="mt-1 text-xs text-green-700">
                    Leave the adjustment quantity blank if you only want to
                    change feed details.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Adjustment Type
                  </label>

                  <select
                    name="stockAdjustmentDirection"
                    value={feedForm.stockAdjustmentDirection}
                    onChange={handleFeedFormChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-green-600"
                  >
                    <option value="add">Add Stock</option>
                    <option value="remove">Reduce Stock</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quantity ({editingFeed.unit})
                  </label>

                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    name="stockAdjustment"
                    value={feedForm.stockAdjustment}
                    onChange={handleFeedFormChange}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-green-600"
                    placeholder="Enter quantity to add or reduce"
                  />

                  <p className="mt-1 text-xs text-gray-500">
                    Enter a positive quantity. The adjustment type determines
                    whether stock increases or decreases.
                  </p>
                </div>

                {hasEditStockAdjustment && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-sm text-gray-600">
                      Projected stock after adjustment:
                    </p>

                    <p
                      className={`mt-1 text-xl font-bold ${
                        editProjectedStock < 0
                          ? "text-red-700"
                          : "text-green-800"
                      }`}
                    >
                      {editProjectedStock.toLocaleString()} {editingFeed.unit}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      {feedForm.stockAdjustmentDirection === "add"
                        ? `Adding ${editAdjustmentQuantity} ${editingFeed.unit}`
                        : `Reducing by ${editAdjustmentQuantity} ${editingFeed.unit}`}
                    </p>

                    {editProjectedStock < 0 && (
                      <p className="mt-2 text-xs font-semibold text-red-600">
                        This adjustment would make your stock negative.
                      </p>
                    )}

                    {editProjectedStock === 0 &&
                      feedForm.stockAdjustmentDirection === "remove" && (
                        <p className="mt-2 text-xs font-semibold text-amber-700">
                          This adjustment will leave you with zero stock.
                        </p>
                      )}
                  </div>
                )}

                {/* SUPERADMIN STOCK REMARKS */}

                {hasEditStockAdjustment && isSuperadmin && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {feedForm.stockAdjustmentDirection === "remove"
                        ? "Reason for Stock Reduction *"
                        : "Remarks (Optional)"}
                    </label>

                    <textarea
                      value={requestRemarks}
                      onChange={(event) =>
                        setRequestRemarks(event.target.value)
                      }
                      rows={3}
                      required={feedForm.stockAdjustmentDirection === "remove"}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-green-600"
                      placeholder={
                        feedForm.stockAdjustmentDirection === "remove"
                          ? "Explain why this feed quantity is being reduced..."
                          : "Explain why this feed stock is being increased..."
                      }
                    />
                  </div>
                )}

                {isManager && (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Your requested stock adjustment will not change the actual
                    inventory until the superadmin approves it.
                  </div>
                )}
              </div>
            )}

            {/* UNIT */}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unit
              </label>

              <select
                name="unit"
                value={feedForm.unit}
                onChange={handleFeedFormChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
              >
                {UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            {/* SUPPLIER */}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Supplier
              </label>

              <input
                name="supplier"
                value={feedForm.supplier}
                onChange={handleFeedFormChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                placeholder="Supplier name"
              />
            </div>

            {/* LOW STOCK THRESHOLD */}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Low Stock Threshold
              </label>

              <input
                type="number"
                min="0"
                step="any"
                name="lowStockThreshold"
                value={feedForm.lowStockThreshold}
                onChange={handleFeedFormChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
              />
            </div>

            {/* DATES */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Purchase Date
                </label>

                <input
                  type="date"
                  name="purchaseDate"
                  value={feedForm.purchaseDate}
                  onChange={handleFeedFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Expiry Date
                </label>

                <input
                  type="date"
                  name="expiryDate"
                  value={feedForm.expiryDate}
                  onChange={handleFeedFormChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                />
              </div>
            </div>

            {/* MANAGER REASON - ONE SHARED FIELD */}

            {editingFeed && isManager && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reason for Requested Changes *
                </label>

                <textarea
                  value={requestRemarks}
                  onChange={(event) => setRequestRemarks(event.target.value)}
                  rows={3}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-green-600"
                  placeholder="Explain why these feed details and/or stock quantities need to be changed..."
                />
              </div>
            )}

            {/* INFORMATION */}

            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              {!editingFeed
                ? "The opening quantity will be recorded as the initial inventory quantity."
                : isManager
                  ? "Your feed detail changes and/or stock adjustment will be submitted for superadmin approval. The actual inventory will remain unchanged until approval."
                  : "Feed details will be updated directly. Any stock adjustment will also be applied immediately and recorded in the inventory transaction history."}
            </div>

            {/* BUTTONS */}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowFeedModal(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-green-700 px-5 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                {saving
                  ? "Processing..."
                  : !editingFeed
                    ? "Create Feed"
                    : isSuperadmin
                      ? "Save Changes"
                      : "Submit Request"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION */}

      {showDeleteModal && selectedFeed && (
        <Modal
          title="Delete Feed Record"
          onClose={() => {
            if (!saving) setShowDeleteModal(false);
          }}
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
              You are about to soft-delete <strong>{selectedFeed.name}</strong>.
              <p className="mt-2">
                This record will no longer appear in the manager's active
                inventory view. Its historical transactions will remain in the
                system.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowDeleteModal(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* APPROVE / REJECT MODAL */}

      {showReviewModal && selectedRequest && (
        <Modal
          title={
            reviewDecision === "APPROVED"
              ? "Approve Feed Request"
              : "Reject Feed Request"
          }
          onClose={() => {
            if (!reviewingId) setShowReviewModal(false);
          }}
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Feed</p>

              <p className="font-bold text-gray-800">
                {getRequestFeedName(selectedRequest)}
              </p>

              <p className="mt-2 text-sm text-gray-600">
                Request type:{" "}
                {selectedRequest.requestType === "STOCK_ADJUSTMENT"
                  ? "Stock Adjustment"
                  : "Details Update"}
              </p>

              <p className="mt-2 break-words text-sm text-gray-600">
                Requested change: {getRequestSummary(selectedRequest)}
              </p>

              {selectedRequest.requestRemarks && (
                <p className="mt-2 text-sm text-gray-600">
                  Manager's remarks: {selectedRequest.requestRemarks}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Review Remarks
              </label>

              <textarea
                value={reviewRemarks}
                onChange={(event) => setReviewRemarks(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Add an approval or rejection comment..."
              />
            </div>

            <div
              className={`rounded-lg p-3 text-xs ${
                reviewDecision === "APPROVED"
                  ? "bg-green-50 text-green-800"
                  : "bg-red-50 text-red-800"
              }`}
            >
              {reviewDecision === "APPROVED"
                ? "Approving this request will execute the requested feed change. Stock adjustments are checked against the current stock balance."
                : "Rejecting this request will leave feed inventory unchanged."}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(reviewingId)}
                onClick={() => setShowReviewModal(false)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={Boolean(reviewingId)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                  reviewDecision === "APPROVED"
                    ? "bg-green-700 hover:bg-green-800"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {reviewingId
                  ? "Processing..."
                  : reviewDecision === "APPROVED"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default FeedInventory;
