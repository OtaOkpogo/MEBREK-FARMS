import { useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
  replyNotification,
} from "../services/notificationService";
import NotificationPopup from "../components/NotificationPopup";
import { getCurrentUser } from "../services/authService";
import socket from "../services/socket";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

import { fetchDashboardData } from "../services/dashboardService";
import { getProfitLossReport } from "../services/reportService";

// ================= ROLE PERMISSIONS =================

const ROLE_PERMISSIONS = {
  superadmin: {
    revenue: true,
    orders: true,
    workers: true,
    production: true,
    feedStock: true,
    mortality: true,
    attendance: true,
    roomInventory: true,
    workerPerformance: true,
  },
  manager: {
    revenue: false,
    orders: true,
    workers: true,
    production: true,
    feedStock: true,
    mortality: true,
    attendance: true,
    roomInventory: true,
    workerPerformance: true,
  },
  staff: {
    revenue: false,
    orders: false,
    workers: false,
    production: true,
    feedStock: false,
    mortality: false,
    attendance: true,
    roomInventory: false,
    workerPerformance: false,
  },
};

const GRID_COLS_MAP = {
  0: "",
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

const gridColsClass = (count) => GRID_COLS_MAP[count] || "md:grid-cols-6";

const EMPTY_EGG_SUMMARY = {
  daily: { cratesProduced: 0, extraEggPieces: 0 },
  weekly: { cratesProduced: 0, extraEggPieces: 0 },
  monthly: { cratesProduced: 0, extraEggPieces: 0 },
  yearly: { cratesProduced: 0, extraEggPieces: 0 },
};

const EMPTY_PROFIT_LOSS = {
  daily: null,
  weekly: null,
  monthly: null,
  yearly: null,
};

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 2,
  });

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  });

const EGG_PERIODS = [
  {
    key: "daily",
    title: "Daily Production",
    subtitle: "Today",
    accent: "border-l-green-600",
    crateColor: "text-green-700",
    eggColor: "text-amber-600",
  },
  {
    key: "weekly",
    title: "Weekly Production",
    subtitle: "Sunday–Friday, excluding Saturday",
    accent: "border-l-blue-600",
    crateColor: "text-blue-700",
    eggColor: "text-amber-600",
  },
  {
    key: "monthly",
    title: "Monthly Production",
    subtitle: "Current calendar month",
    accent: "border-l-purple-600",
    crateColor: "text-purple-700",
    eggColor: "text-amber-600",
  },
  {
    key: "yearly",
    title: "Yearly Production",
    subtitle: "Current calendar year",
    accent: "border-l-orange-500",
    crateColor: "text-orange-700",
    eggColor: "text-amber-600",
  },
];

const PROFIT_LOSS_PERIODS = [
  {
    key: "daily",
    title: "Daily",
    subtitle: "Today's recorded transactions",
    accent: "border-l-green-600",
  },
  {
    key: "weekly",
    title: "Weekly",
    subtitle: "Sunday–Friday; Saturday excluded",
    accent: "border-l-blue-600",
  },
  {
    key: "monthly",
    title: "Monthly",
    subtitle: "Current calendar month",
    accent: "border-l-purple-600",
  },
  {
    key: "yearly",
    title: "Yearly",
    subtitle: "Current calendar year",
    accent: "border-l-orange-500",
  },
];

const getStoredRole = () => {
  try {
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

    return String(storedUser.role || localStorage.getItem("role") || "staff")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  } catch {
    return String(localStorage.getItem("role") || "staff")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
  }
};

// Notification helpers
const getNotificationId = (notification) =>
  String(notification?._id || notification?.id || "");

const getSenderId = (notification) =>
  String(
    notification?.senderId?._id ||
      notification?.senderId ||
      notification?.sender?._id ||
      notification?.sender ||
      "",
  );

// Shared styling for dashboard cards
const CARD_STYLE = "bg-white border border-[#e5ebe3] rounded-2xl shadow-sm";

const CHART_STYLE =
  "bg-white border border-[#e5ebe3] p-5 sm:p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200";

// ================= DASHBOARD =================

export default function Dashboard() {
  const [data, setData] = useState({
    orders: [],
    workers: [],
    production: [],
    feeds: [],
    attendance: [],
    mortality: [],
    roomInventory: [],
    roomInventorySummary: [],
    estimatedRevenue: 0,
    eggProductionSummary: EMPTY_EGG_SUMMARY,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  // Notification popup state
  const [popupVisible, setPopupVisible] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  // Financial report state
  const [profitLoss, setProfitLoss] = useState(EMPTY_PROFIT_LOSS);
  const [profitLossLoading, setProfitLossLoading] = useState(false);
  const [profitLossError, setProfitLossError] = useState("");

  // ================= INITIAL LOAD =================

  useEffect(() => {
    loadDashboard();
    loadUser();
  }, []);

  // ================= DASHBOARD DATA =================

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetchDashboardData();

      setData({
        orders: Array.isArray(res?.orders) ? res.orders : [],
        workers: Array.isArray(res?.workers) ? res.workers : [],
        production: Array.isArray(res?.production) ? res.production : [],
        feeds: Array.isArray(res?.feeds) ? res.feeds : [],
        attendance: Array.isArray(res?.attendance) ? res.attendance : [],
        mortality: Array.isArray(res?.mortality) ? res.mortality : [],
        roomInventory: Array.isArray(res?.roomInventory)
          ? res.roomInventory
          : [],
        roomInventorySummary: Array.isArray(res?.roomInventorySummary)
          ? res.roomInventorySummary
          : [],
        estimatedRevenue: res?.estimatedRevenue ?? 0,
        eggProductionSummary: res?.eggProductionSummary || EMPTY_EGG_SUMMARY,
      });
    } catch (err) {
      console.error("LOAD DASHBOARD ERROR:", err);
      setError(err?.response?.data?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ================= USER =================

  const loadUser = async () => {
    try {
      const response = await getCurrentUser();

      const currentUser =
        response?.admin ||
        response?.user ||
        response?.data?.admin ||
        response?.data?.user ||
        response?.data ||
        response;

      setUser(currentUser);
    } catch (err) {
      console.error("LOAD USER ERROR:", err);

      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(storedUser);
      } catch {
        setUser(null);
      }
    }
  };

  // ================= PERMISSIONS =================

  const role = String(user?.role || getStoredRole())
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;

  const isSuperAdmin = role === "superadmin";
  const isManager = role === "manager";

  // ================= PROFIT AND LOSS =================

  const loadProfitLoss = async () => {
    if (!isSuperAdmin) {
      setProfitLoss(EMPTY_PROFIT_LOSS);
      setProfitLossError("");
      setProfitLossLoading(false);
      return;
    }

    try {
      setProfitLossLoading(true);
      setProfitLossError("");

      const response = await getProfitLossReport();
      const periods = response?.periods || {};

      setProfitLoss({
        daily: periods.daily || null,
        weekly: periods.weekly || null,
        monthly: periods.monthly || null,
        yearly: periods.yearly || null,
      });
    } catch (err) {
      console.error("LOAD PROFIT AND LOSS ERROR:", err);

      setProfitLossError(
        err?.response?.data?.message ||
          "Unable to load the profit and loss report.",
      );
    } finally {
      setProfitLossLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadProfitLoss();
    } else {
      setProfitLoss(EMPTY_PROFIT_LOSS);
      setProfitLossError("");
      setProfitLossLoading(false);
    }
  }, [isSuperAdmin]);

  // ================= LIVE NOTIFICATIONS =================

  useEffect(() => {
    // Never show Dashboard notification popups to other roles.
    if (!isSuperAdmin) {
      setPopupVisible(false);
      setUnreadNotifications([]);
      return;
    }

    const currentUserId = String(user?._id || user?.id || user?.adminId || "");

    const handleNewNotification = (notification) => {
      if (!notification) return;

      // Ignore messages sent by the currently logged-in superadmin.
      const senderId = getSenderId(notification);

      if (currentUserId && senderId === currentUserId) {
        return;
      }

      const notificationId = getNotificationId(notification);

      if (!notificationId) return;

      // Add only genuinely new notifications.
      setUnreadNotifications((previous) => {
        const alreadyExists = previous.some(
          (item) => getNotificationId(item) === notificationId,
        );

        if (alreadyExists) {
          return previous;
        }

        return [notification, ...previous];
      });

      setPopupVisible(true);
    };

    socket.on("notificationCreated", handleNewNotification);

    return () => {
      socket.off("notificationCreated", handleNewNotification);
    };
  }, [isSuperAdmin, user]);

  // ================= NOTIFICATION ACTIONS =================

  const handleReply = async (id, message) => {
    try {
      await replyNotification(id, { message });
    } catch (err) {
      console.error("REPLY NOTIFICATION ERROR:", err);
      throw err;
    }
  };

  const markRead = async (id) => {
    try {
      await markNotificationRead(id);

      setUnreadNotifications((previous) =>
        previous.filter(
          (notification) => getNotificationId(notification) !== String(id),
        ),
      );
    } catch (err) {
      console.error("MARK NOTIFICATION READ ERROR:", err);
    }
  };

  // ================= DATA =================

  const orders = data.orders;
  const workers = data.workers;
  const production = data.production;
  const feeds = data.feeds;
  const attendance = data.attendance;
  const mortality = data.mortality;
  const roomInventory = data.roomInventory;
  const roomInventorySummary = data.roomInventorySummary;

  const eggProductionSummary = data.eggProductionSummary || EMPTY_EGG_SUMMARY;

  const dailyEggSummary = eggProductionSummary.daily || {
    cratesProduced: 0,
    extraEggPieces: 0,
  };

  // ================= KPI =================

  const totalOrders = orders.length;
  const totalWorkers = workers.length;

  const totalEggs = production.reduce(
    (sum, item) => sum + Number(item.totalEggs || 0),
    0,
  );

  const estimatedRevenue = data.estimatedRevenue || 0;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const totalMortality = mortality.reduce(
    (sum, item) => sum + Number(item.numberDead || 0),
    0,
  );

  const totalRooms = roomInventorySummary.length;

  const totalRoomItems = roomInventorySummary.reduce(
    (sum, room) => sum + Number(room.totalQuantity || 0),
    0,
  );

  const damagedItems = roomInventorySummary.reduce(
    (sum, room) => sum + Number(room.damagedQuantity || 0),
    0,
  );

  const missingItems = roomInventorySummary.reduce(
    (sum, room) => sum + Number(room.missingQuantity || 0),
    0,
  );

  const goodItems = roomInventorySummary.reduce(
    (sum, room) => sum + Number(room.goodQuantity || 0),
    0,
  );

  // ================= ATTENDANCE =================

  const presentCount = attendance.filter(
    (item) => item.status === "Present",
  ).length;

  const absentCount = attendance.filter(
    (item) => item.status === "Absent",
  ).length;

  const lateCount = attendance.filter((item) => item.status === "Late").length;

  // ================= CHART DATA =================

  const productionChart = production.map((item) => ({
    date: item.date ? new Date(item.date).toLocaleDateString() : "Unknown",
    eggs: Number(item.totalEggs || 0),
  }));

  const inventoryChart = feeds.map((item) => ({
    name: item.name,
    stock: Number(item.quantity || 0),
  }));

  const workerPerformance = workers.map((worker) => ({
    name:
      worker.name ||
      `${worker.firstName || ""} ${worker.lastName || ""}`.trim() ||
      "Worker",
    performance: worker.performance || 0,
  }));

  const farmOverview = [
    perms.orders && {
      name: "Orders",
      value: totalOrders,
    },
    perms.workers && {
      name: "Workers",
      value: totalWorkers,
    },
    perms.production && {
      name: "Eggs",
      value: totalEggs,
    },
    perms.mortality && {
      name: "Mortality",
      value: totalMortality,
    },
  ].filter(Boolean);

  const attendanceChart = [
    { name: "Present", value: presentCount },
    { name: "Absent", value: absentCount },
    { name: "Late", value: lateCount },
  ];

  const roomChart = [
    { name: "Good", value: goodItems },
    { name: "Damaged", value: damagedItems },
    { name: "Missing", value: missingItems },
  ];

  const COLORS = ["#4d8060", "#6688a5", "#d8a64b", "#c76b5b"];

  // ================= KPI CARDS =================

  const kpiCards = [
    perms.orders && {
      key: "orders",
      label: "Orders",
      value: totalOrders,
      color: "text-green-700",
    },
    perms.workers && {
      key: "workers",
      label: "Workers",
      value: totalWorkers,
      color: "text-blue-700",
    },
    perms.production && {
      key: "production",
      label: "Egg Production",
      value: formatNumber(totalEggs),
      color: "text-amber-700",
    },
    perms.revenue && {
      key: "revenue",
      label: "Estimated Revenue",
      value: formatCurrency(estimatedRevenue),
      color: "text-purple-700",
    },
    perms.feedStock && {
      key: "feedStock",
      label: "Feed Stock",
      value: formatNumber(totalFeedStock),
      color: "text-green-800",
    },
    perms.mortality && {
      key: "mortality",
      label: "Mortality",
      value: formatNumber(totalMortality),
      color: "text-red-700",
    },
  ].filter(Boolean);

  const showEggTrend = perms.production;
  const showFarmOverview = farmOverview.length > 0;

  const row1Count = [showEggTrend, showFarmOverview].filter(Boolean).length;

  const showAttendance = perms.attendance;
  const showWorkerPerf = perms.workerPerformance;

  const row2Count = [showAttendance, showWorkerPerf].filter(Boolean).length;

  // ================= LOADING STATE =================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-[#f6f8f4]">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-[#dce8dc] border-t-[#39734d] rounded-full animate-spin mx-auto" />

          <p className="mt-6 text-lg font-semibold text-[#294b36]">
            Loading Dashboard...
          </p>

          <p className="text-gray-500 text-sm mt-1">
            Please wait while we fetch your farm data.
          </p>
        </div>
      </div>
    );
  }

  // ================= ERROR STATE =================

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-[#f6f8f4] p-4">
        <div className="bg-white border border-red-100 shadow-sm rounded-2xl p-8 sm:p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">⚠️</div>

          <h2 className="text-xl sm:text-2xl font-bold text-red-700">
            Something went wrong
          </h2>

          <p className="text-gray-600 mt-3 text-sm">{error}</p>

          <button
            onClick={loadDashboard}
            className="mt-6 bg-[#39734d] hover:bg-[#2e603f] text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================

  return (
    <div className="p-4 sm:p-6 bg-[#f6f8f4] min-h-screen">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest font-semibold text-[#829482]">
          Mebrek Farms / Administration
        </p>

        <h1 className="text-2xl sm:text-3xl font-bold text-[#294b36] mt-2">
          Mebrek Farms Dashboard 🚜
        </h1>

        <p className="text-gray-500 mt-2 text-sm sm:text-base">
          Farm Operations Monitoring Center
        </p>
      </div>

      {/* Welcome panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#294b36] to-[#477b53] rounded-2xl shadow-md p-6 sm:p-7 mb-8 text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-24 -bottom-16 w-40 h-40 rounded-full bg-white/5" />

        <div className="relative z-10">
          <p className="text-green-100 text-sm font-medium">Welcome back</p>

          <h2 className="text-2xl sm:text-3xl font-bold mt-1">
            {user?.name || user?.adminName || "User"} 👋
          </h2>

          <p className="text-green-100 text-sm mt-2">
            Here's an overview of your farm operations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">
            <div className="bg-white/10 border border-white/10 rounded-xl p-4">
              <p className="text-green-100 text-xs uppercase tracking-wide">
                Role
              </p>

              <p className="font-bold text-lg mt-1 capitalize">
                {role === "superadmin" ? "Super Admin" : role}
              </p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-xl p-4">
              <p className="text-green-100 text-xs uppercase tracking-wide">
                Account Status
              </p>

              <p
                className={`font-bold text-lg mt-1 ${
                  String(user?.status ?? "active").toLowerCase() === "active"
                    ? "text-green-100"
                    : "text-red-200"
                }`}
              >
                {String(user?.status ?? "active").toUpperCase()}
              </p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-xl p-4">
              <p className="text-green-100 text-xs uppercase tracking-wide">
                Last Login
              </p>

              <p className="font-bold text-sm sm:text-base mt-2">
                {user?.lastLogin
                  ? new Date(user.lastLogin).toLocaleString("en-NG", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : "Never"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {kpiCards.length > 0 && (
        <div className={`grid ${gridColsClass(kpiCards.length)} gap-5 mb-8`}>
          {kpiCards.map((card) => (
            <div
              key={card.key}
              className={`${CARD_STYLE} p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
            >
              <h3 className="text-sm font-medium text-gray-500">
                {card.label}
              </h3>

              <p
                className={`text-2xl sm:text-3xl font-bold mt-3 break-words ${card.color}`}
              >
                {card.value}
              </p>

              <div className="w-10 h-1 rounded-full bg-[#dce8dc] mt-4" />
            </div>
          ))}
        </div>
      )}

      {/* SUPERADMIN-ONLY PROFIT AND LOSS */}
      {isSuperAdmin && (
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#294b36]">
                Farm Profit &amp; Loss 💰
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Recorded egg and manure sales less recorded expenses and feed
                invoices.
              </p>

              <p className="text-xs text-gray-400 mt-1">
                Currency: NGN · Farm timezone: Africa/Lagos
              </p>
            </div>

            <button
              type="button"
              onClick={loadProfitLoss}
              disabled={profitLossLoading}
              className="px-4 py-2.5 rounded-xl bg-[#39734d] hover:bg-[#2e603f] disabled:opacity-60 text-white font-semibold text-sm transition-colors"
            >
              {profitLossLoading ? "Refreshing..." : "Refresh Financials"}
            </button>
          </div>

          {profitLossError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5">
              <p className="font-semibold">{profitLossError}</p>

              <p className="text-sm mt-1">
                Your other dashboard sections are still available. Check that
                the superadmin-only profit/loss API route is configured.
              </p>
            </div>
          )}

          {profitLossLoading &&
          !PROFIT_LOSS_PERIODS.some((period) => profitLoss[period.key]) ? (
            <div className={`${CARD_STYLE} p-8 text-center text-gray-500`}>
              Loading financial summary...
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {PROFIT_LOSS_PERIODS.map((period) => {
                const summary = profitLoss[period.key];

                const totalIncome = Number(summary?.income?.totalIncome || 0);
                const totalExpenses = Number(
                  summary?.expenses?.totalExpenses || 0,
                );
                const netProfit = Number(summary?.netProfit || 0);

                const isLoss = netProfit < 0;
                const isProfit = netProfit > 0;

                return (
                  <article
                    key={period.key}
                    className={`${CARD_STYLE} border-l-4 ${period.accent} p-5`}
                  >
                    <h3 className="text-lg font-bold text-[#294b36]">
                      {period.title}
                    </h3>

                    <p className="text-xs text-gray-500 mt-1 mb-4">
                      {period.subtitle}
                    </p>

                    {!summary ? (
                      <div className="bg-[#f6f8f4] rounded-xl p-4 text-sm text-gray-500">
                        {profitLossError
                          ? "Financial data unavailable."
                          : "No summary available."}
                      </div>
                    ) : (
                      <>
                        <div className="bg-[#edf5ee] rounded-xl p-3 mb-3">
                          <p className="text-xs text-gray-600">
                            Recorded income
                          </p>

                          <p className="text-xl font-bold text-[#39734d] break-words mt-1">
                            {formatCurrency(totalIncome)}
                          </p>
                        </div>

                        <div className="bg-[#fbefed] rounded-xl p-3 mb-3">
                          <p className="text-xs text-gray-600">
                            Recorded expenses
                          </p>

                          <p className="text-xl font-bold text-[#b45345] break-words mt-1">
                            {formatCurrency(totalExpenses)}
                          </p>
                        </div>

                        <div
                          className={`rounded-xl p-4 ${
                            isLoss
                              ? "bg-red-50"
                              : isProfit
                                ? "bg-emerald-50"
                                : "bg-gray-100"
                          }`}
                        >
                          <p className="text-sm text-gray-700">
                            Net {isLoss ? "loss" : "profit"}
                          </p>

                          <p
                            className={`text-2xl font-bold break-words mt-1 ${
                              isLoss
                                ? "text-red-800"
                                : isProfit
                                  ? "text-emerald-800"
                                  : "text-gray-800"
                            }`}
                          >
                            {formatCurrency(netProfit)}
                          </p>

                          <p
                            className={`text-xs font-semibold mt-2 ${
                              isLoss
                                ? "text-red-800"
                                : isProfit
                                  ? "text-emerald-800"
                                  : "text-gray-700"
                            }`}
                          >
                            {summary.result ||
                              (isLoss
                                ? "Loss"
                                : isProfit
                                  ? "Profit"
                                  : "Break-even")}
                          </p>
                        </div>

                        <div className="border-t border-gray-100 mt-4 pt-3 space-y-2">
                          <div className="flex justify-between gap-2 text-xs text-gray-500">
                            <span>Egg sales</span>
                            <span className="text-right font-medium text-gray-700">
                              {formatCurrency(summary.income?.eggSales)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-2 text-xs text-gray-500">
                            <span>Manure sales</span>
                            <span className="text-right font-medium text-gray-700">
                              {formatCurrency(summary.income?.manureSales)}
                            </span>
                          </div>

                          <div className="flex justify-between gap-2 text-xs text-gray-500">
                            <span>Feed purchases &amp; transport</span>
                            <span className="text-right font-medium text-gray-700">
                              {formatCurrency(
                                Number(summary.expenses?.feedPurchases || 0) +
                                  Number(summary.expenses?.feedTransport || 0),
                              )}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 leading-relaxed">
            This summary uses recorded sales and purchase/expense dates. It is
            not a full accrual-accounting statement and does not calculate the
            historical cost of feed consumed. Receipts recorded against older
            sales cannot be assigned to the day received without payment
            transaction dates.
          </p>
        </section>
      )}

      {/* MANAGER-ONLY DAILY EGG PRODUCTION */}
      {isManager && (
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#294b36]">
                Daily Egg Production 🥚
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Production recorded during the last 24 hours, for customer crate
                bookings.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDashboard}
              className="px-4 py-2.5 rounded-xl bg-[#39734d] hover:bg-[#2e603f] text-white font-semibold text-sm transition-colors"
            >
              Refresh Production
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <article
              className={`${CARD_STYLE} border-l-4 border-l-green-600 p-6`}
            >
              <p className="text-sm font-medium text-gray-500">
                Crates Produced
              </p>

              <p className="text-3xl sm:text-4xl font-bold text-green-700 mt-3">
                {formatNumber(dailyEggSummary.cratesProduced)}
              </p>

              <p className="text-xs text-gray-500 mt-3">
                Total crates from production records in the last 24 hours.
              </p>
            </article>

            <article
              className={`${CARD_STYLE} border-l-4 border-l-amber-500 p-6`}
            >
              <p className="text-sm font-medium text-gray-500">
                Extra Egg Pieces
              </p>

              <p className="text-3xl sm:text-4xl font-bold text-amber-600 mt-3">
                {formatNumber(dailyEggSummary.extraEggPieces)}
              </p>

              <p className="text-xs text-gray-500 mt-3">
                Loose eggs recorded separately from full crates.
              </p>
            </article>
          </div>
        </section>
      )}

      {/* SUPERADMIN-ONLY EGG PRODUCTION SUMMARY */}
      {isSuperAdmin && (
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#294b36]">
                Egg Production Summary 🥚
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Crates and extra egg pieces recorded across all pens.
              </p>
            </div>

            <span className="text-xs font-semibold text-[#39734d] bg-[#e8f1e7] rounded-full px-3 py-1.5 w-fit">
              Superadmin view
            </span>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {EGG_PERIODS.map((period) => {
              const summary = eggProductionSummary[period.key] || {
                cratesProduced: 0,
                extraEggPieces: 0,
              };

              return (
                <article
                  key={period.key}
                  className={`${CARD_STYLE} border-l-4 ${period.accent} p-5`}
                >
                  <h3 className="text-lg font-bold text-[#294b36]">
                    {period.title}
                  </h3>

                  <p className="text-xs text-gray-500 mt-1 mb-5">
                    {period.subtitle}
                  </p>

                  <div className="bg-[#f6f8f4] rounded-xl p-4 mb-3">
                    <p className="text-sm text-gray-500">Crates produced</p>

                    <p
                      className={`text-3xl font-bold mt-2 ${period.crateColor}`}
                    >
                      {formatNumber(summary.cratesProduced)}
                    </p>
                  </div>

                  <div className="bg-[#fbf5e9] rounded-xl p-4">
                    <p className="text-sm text-gray-600">Extra egg pieces</p>

                    <p className={`text-2xl font-bold mt-2 ${period.eggColor}`}>
                      {formatNumber(summary.extraEggPieces)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ROOM INVENTORY KPIs */}
      {perms.roomInventory && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-5 mb-8">
          <div className={`${CARD_STYLE} p-5`}>
            <h3 className="text-sm text-gray-500">Rooms</h3>
            <p className="text-2xl sm:text-3xl font-bold text-indigo-600 mt-3">
              {formatNumber(totalRooms)}
            </p>
          </div>

          <div className={`${CARD_STYLE} p-5`}>
            <h3 className="text-sm text-gray-500">Inventory Items</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-700 mt-3">
              {formatNumber(totalRoomItems)}
            </p>
          </div>

          <div className={`${CARD_STYLE} p-5`}>
            <h3 className="text-sm text-gray-500">Good Items</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-3">
              {formatNumber(goodItems)}
            </p>
          </div>

          <div className={`${CARD_STYLE} p-5`}>
            <h3 className="text-sm text-gray-500">Damaged</h3>
            <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-3">
              {formatNumber(damagedItems)}
            </p>
          </div>

          <div className={`${CARD_STYLE} p-5`}>
            <h3 className="text-sm text-gray-500">Missing</h3>
            <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-3">
              {formatNumber(missingItems)}
            </p>
          </div>
        </div>
      )}

      {/* PRODUCTION TREND AND FARM OVERVIEW */}
      {row1Count > 0 && (
        <div className={`grid ${gridColsClass(row1Count)} gap-5 mb-8`}>
          {showEggTrend && (
            <div className={CHART_STYLE}>
              <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
                Egg Production Trend 🥚
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Production performance across recorded dates.
              </p>

              <ResponsiveContainer
                width="100%"
                height={300}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <LineChart data={productionChart}>
                  <CartesianGrid stroke="#e8eee7" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="eggs"
                    name="Total eggs"
                    stroke="#4d8060"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {showFarmOverview && (
            <div className={CHART_STYLE}>
              <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
                Farm Overview 📊
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Summary of important farm activities.
              </p>

              <ResponsiveContainer
                width="100%"
                height={300}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <PieChart>
                  <Pie
                    data={farmOverview}
                    dataKey="value"
                    outerRadius={110}
                    label
                  >
                    {farmOverview.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* FEED INVENTORY */}
      {perms.feedStock && (
        <div className={`${CHART_STYLE} mb-8`}>
          <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
            Feed Inventory 🌽
          </h2>

          <p className="text-sm text-gray-500 mb-4">
            Overview of recorded feed quantities.
          </p>

          <ResponsiveContainer
            width="100%"
            height={350}
            minWidth={0}
            minHeight={200}
            debounce={200}
          >
            <BarChart data={inventoryChart}>
              <CartesianGrid stroke="#e8eee7" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
              <Tooltip />
              <Legend />

              <Bar
                dataKey="stock"
                name="Stock"
                fill="#668b69"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ATTENDANCE AND WORKER PERFORMANCE */}
      {row2Count > 0 && (
        <div className={`grid ${gridColsClass(row2Count)} gap-5`}>
          {showAttendance && (
            <div className={CHART_STYLE}>
              <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
                Attendance Analytics 📅
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Distribution of recorded attendance statuses.
              </p>

              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <PieChart>
                  <Pie
                    data={attendanceChart}
                    dataKey="value"
                    outerRadius={110}
                    label
                  >
                    <Cell fill="#4d8060" />
                    <Cell fill="#c76b5b" />
                    <Cell fill="#d8a64b" />
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {showWorkerPerf && (
            <div className={CHART_STYLE}>
              <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
                Worker Performance 📈
              </h2>

              <p className="text-sm text-gray-500 mb-4">
                Performance figures from worker records.
              </p>

              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <BarChart data={workerPerformance}>
                  <CartesianGrid stroke="#e8eee7" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                  <Tooltip />
                  <Legend />

                  <Bar
                    dataKey="performance"
                    name="Performance"
                    fill="#6688a5"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ROOM INVENTORY CHARTS AND RECENT RECORDS */}
      {perms.roomInventory && (
        <div className="grid md:grid-cols-2 gap-5 mt-8">
          <div className={CHART_STYLE}>
            <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
              Room Inventory Status 🏠
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              Overview of room inventory conditions.
            </p>

            <ResponsiveContainer
              width="100%"
              height={320}
              minWidth={0}
              minHeight={200}
              debounce={200}
            >
              <PieChart>
                <Pie data={roomChart} dataKey="value" outerRadius={110} label>
                  <Cell fill="#4d8060" />
                  <Cell fill="#d8a64b" />
                  <Cell fill="#c76b5b" />
                </Pie>

                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className={CHART_STYLE}>
            <h2 className="text-lg sm:text-xl font-bold text-[#294b36] mb-2">
              Recent Room Inventory
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              Latest available room inventory records.
            </p>

            <div className="overflow-auto max-h-80">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-[#e5ebe3] bg-[#f6f8f4]">
                    <th className="text-left py-3 px-3 text-gray-600 font-semibold">
                      Room
                    </th>

                    <th className="text-left py-3 px-3 text-gray-600 font-semibold">
                      Item
                    </th>

                    <th className="text-left py-3 px-3 text-gray-600 font-semibold">
                      Condition
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {roomInventory.slice(0, 10).map((item, index) => (
                    <tr
                      key={item._id || index}
                      className="border-b border-gray-100 hover:bg-[#f8faf7] transition-colors"
                    >
                      <td className="py-3 px-3 text-gray-700 font-medium">
                        {item.roomName}
                      </td>

                      <td className="py-3 px-3 text-gray-600">
                        {item.itemName}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            item.condition === "Good"
                              ? "bg-green-50 text-green-700"
                              : item.condition === "Damaged" ||
                                  item.condition === "Needs Repair"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {item.condition}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {roomInventory.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-8 text-center text-gray-500"
                      >
                        No room inventory records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUPERADMIN LIVE NOTIFICATION POPUP */}
      {isSuperAdmin && popupVisible && (
        <NotificationPopup
          notifications={unreadNotifications}
          onClose={() => setPopupVisible(false)}
          onMarkRead={markRead}
          onReply={handleReply}
        />
      )}
    </div>
  );
}
