import { useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
  replyNotification,
} from "../services/notificationService";
import NotificationPopup from "../components/NotificationPopup";
import { getCurrentUser } from "../services/authService";
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

const formatNumber = (value) => Number(value || 0).toLocaleString("en-NG");

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
  const [popupVisible, setPopupVisible] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([]);

  useEffect(() => {
    loadDashboard();
    loadUser();
    checkNotifications();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetchDashboardData();

      setData({
        orders: res?.orders || [],
        workers: res?.workers || [],
        production: res?.production || [],
        feeds: res?.feeds || [],
        attendance: res?.attendance || [],
        mortality: res?.mortality || [],
        roomInventory: res?.roomInventory || [],
        roomInventorySummary: res?.roomInventorySummary || [],
        estimatedRevenue: res?.estimatedRevenue ?? 0,
        // The backend only sends this property to superadmin.
        eggProductionSummary: res?.eggProductionSummary || EMPTY_EGG_SUMMARY,
      });
    } catch (err) {
      console.error("LOAD DASHBOARD ERROR:", err);
      setError(err?.response?.data?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const response = await getCurrentUser();
      const currentUser =
        response?.admin || response?.user || response?.data || response;

      setUser(currentUser);
    } catch (err) {
      console.error("LOAD USER ERROR:", err);

      // Fallback to the existing stored user if the profile request fails.
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(storedUser);
      } catch {
        setUser(null);
      }
    }
  };

  const checkNotifications = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

      if (storedUser.role !== "superadmin") {
        return;
      }

      const res = await getNotifications();

      const notifications = Array.isArray(res)
        ? res
        : Array.isArray(res?.notifications)
          ? res.notifications
          : Array.isArray(res?.data)
            ? res.data
            : [];

      const unread = notifications.filter(
        (notification) => !notification.isRead,
      );

      setUnreadNotifications(unread);
      setPopupVisible(unread.length > 0);
    } catch (err) {
      console.error("CHECK NOTIFICATIONS ERROR:", err);
    }
  };

  const handleReply = async (id, message) => {
    try {
      await replyNotification(id, { message });
      await checkNotifications();
    } catch (err) {
      console.error("REPLY NOTIFICATION ERROR:", err);
      throw err;
    }
  };

  const markRead = async (id) => {
    try {
      await markNotificationRead(id);

      setUnreadNotifications((prev) =>
        prev.filter((notification) => notification._id !== id),
      );
    } catch (err) {
      console.error("MARK NOTIFICATION READ ERROR:", err);
    }
  };

  // ================= PERMISSIONS =================

  const role = String(
    user?.role ||
      (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "{}").role;
        } catch {
          return "staff";
        }
      })() ||
      "staff",
  ).toLowerCase();

  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;
  const isSuperAdmin = role === "superadmin";

  // ================= DATA =================

  const orders = data.orders;
  const workers = data.workers;
  const production = data.production;
  const feeds = data.feeds;
  const attendance = data.attendance;
  const mortality = data.mortality;
  const roomInventory = data.roomInventory || [];
  const roomInventorySummary = data.roomInventorySummary || [];
  const eggProductionSummary = data.eggProductionSummary || EMPTY_EGG_SUMMARY;

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
    perms.orders && { name: "Orders", value: totalOrders },
    perms.workers && { name: "Workers", value: totalWorkers },
    perms.production && { name: "Eggs", value: totalEggs },
    perms.mortality && { name: "Mortality", value: totalMortality },
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

  const COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626"];

  // ================= KPI CARDS =================

  const kpiCards = [
    perms.orders && {
      key: "orders",
      label: "Orders",
      value: totalOrders,
      color: "text-green-600",
    },
    perms.workers && {
      key: "workers",
      label: "Workers",
      value: totalWorkers,
      color: "text-blue-600",
    },
    perms.production && {
      key: "production",
      label: "Egg Production",
      value: formatNumber(totalEggs),
      color: "text-yellow-600",
    },
    perms.revenue && {
      key: "revenue",
      label: "Revenue",
      value: `₦${formatNumber(estimatedRevenue)}`,
      color: "text-purple-600",
    },
    perms.feedStock && {
      key: "feedStock",
      label: "Feed Stock",
      value: formatNumber(totalFeedStock),
      color: "text-green-700",
    },
    perms.mortality && {
      key: "mortality",
      label: "Mortality",
      value: formatNumber(totalMortality),
      color: "text-red-600",
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
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-6 text-lg font-semibold text-gray-700">
            Loading Dashboard...
          </p>
          <p className="text-gray-500">
            Please wait while we fetch your farm data.
          </p>
        </div>
      </div>
    );
  }

  // ================= ERROR STATE =================

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="bg-white shadow-lg rounded-2xl p-10 text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600">
            Something went wrong
          </h2>
          <p className="text-gray-600 mt-3">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ================= DASHBOARD =================

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Mebrek Farms Dashboard 🚜
        </h1>
        <p className="text-gray-600 mt-2">Farm Operations Monitoring Center</p>
      </div>

      {/* Welcome panel */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <h2 className="text-3xl font-bold text-green-700">
          Welcome back {user?.name || user?.adminName || "User"} 👋
        </h2>
        <p className="text-gray-500 mt-2">Farm Management Dashboard</p>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-gray-500 text-sm">Role</p>
            <p className="font-bold text-lg uppercase">{role}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-gray-500 text-sm">Status</p>
            <p
              className={`font-bold text-lg ${
                String(user?.status ?? "active").toLowerCase() === "active"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {String(user?.status ?? "active").toUpperCase()}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-gray-500 text-sm">Last Login</p>
            <p className="font-bold text-lg">
              {user?.lastLogin
                ? new Date(user.lastLogin).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>
      </div>

      {/* Existing KPI cards */}
      {kpiCards.length > 0 && (
        <div className={`grid ${gridColsClass(kpiCards.length)} gap-6 mb-8`}>
          {kpiCards.map((card) => (
            <div key={card.key} className="bg-white p-5 rounded-2xl shadow">
              <h3 className="text-gray-500">{card.label}</h3>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* SUPERADMIN-ONLY EGG PRODUCTION SUMMARY */}
      {isSuperAdmin && (
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Egg Production Summary 🥚
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Crates and extra egg pieces recorded across all pens.
              </p>
            </div>
            <span className="text-xs font-semibold text-green-800 bg-green-100 rounded-full px-3 py-1 w-fit">
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
                  className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${period.accent} p-5`}
                >
                  <h3 className="text-lg font-bold text-gray-800">
                    {period.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 mb-5">
                    {period.subtitle}
                  </p>

                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-sm text-gray-500">Crates produced</p>
                    <p className={`text-3xl font-bold ${period.crateColor}`}>
                      {formatNumber(summary.cratesProduced)}
                    </p>
                  </div>

                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">Extra egg pieces</p>
                    <p className={`text-2xl font-bold ${period.eggColor}`}>
                      {formatNumber(summary.extraEggPieces)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Room inventory KPIs */}
      {perms.roomInventory && (
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Rooms</h3>
            <p className="text-3xl font-bold text-indigo-600">
              {formatNumber(totalRooms)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Inventory Items</h3>
            <p className="text-3xl font-bold text-green-700">
              {formatNumber(totalRoomItems)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Good Items</h3>
            <p className="text-3xl font-bold text-green-500">
              {formatNumber(goodItems)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Damaged</h3>
            <p className="text-3xl font-bold text-yellow-500">
              {formatNumber(damagedItems)}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Missing</h3>
            <p className="text-3xl font-bold text-red-600">
              {formatNumber(missingItems)}
            </p>
          </div>
        </div>
      )}

      {/* Production trend and farm overview */}
      {row1Count > 0 && (
        <div className={`grid ${gridColsClass(row1Count)} gap-6 mb-8`}>
          {showEggTrend && (
            <div className="bg-white p-6 rounded-2xl shadow">
              <h2 className="text-xl font-bold mb-4">
                Egg Production Trend 🥚
              </h2>

              <ResponsiveContainer
                width="100%"
                height={300}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <LineChart data={productionChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="eggs"
                    name="Total eggs"
                    stroke="#16a34a"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {showFarmOverview && (
            <div className="bg-white p-6 rounded-2xl shadow">
              <h2 className="text-xl font-bold mb-4">Farm Overview 📊</h2>

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

      {/* Feed inventory */}
      {perms.feedStock && (
        <div className="bg-white p-6 rounded-2xl shadow mb-8">
          <h2 className="text-xl font-bold mb-4">Feed Inventory 🌽</h2>

          <ResponsiveContainer
            width="100%"
            height={350}
            minWidth={0}
            minHeight={200}
            debounce={200}
          >
            <BarChart data={inventoryChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="stock" name="Stock" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attendance and worker performance */}
      {row2Count > 0 && (
        <div className={`grid ${gridColsClass(row2Count)} gap-6`}>
          {showAttendance && (
            <div className="bg-white p-6 rounded-2xl shadow">
              <h2 className="text-xl font-bold mb-4">
                Attendance Analytics 📅
              </h2>

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
                    <Cell fill="#16a34a" />
                    <Cell fill="#dc2626" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {showWorkerPerf && (
            <div className="bg-white p-6 rounded-2xl shadow">
              <h2 className="text-xl font-bold mb-4">Worker Performance 📈</h2>

              <ResponsiveContainer
                width="100%"
                height={320}
                minWidth={0}
                minHeight={200}
                debounce={200}
              >
                <BarChart data={workerPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="performance"
                    name="Performance"
                    fill="#2563eb"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Room inventory charts and recent records */}
      {perms.roomInventory && (
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Room Inventory Status 🏠</h2>

            <ResponsiveContainer
              width="100%"
              height={320}
              minWidth={0}
              minHeight={200}
              debounce={200}
            >
              <PieChart>
                <Pie data={roomChart} dataKey="value" outerRadius={110} label>
                  <Cell fill="#22c55e" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-xl font-bold mb-4">Recent Room Inventory</h2>

            <div className="overflow-auto max-h-80">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Room</th>
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Condition</th>
                  </tr>
                </thead>

                <tbody>
                  {roomInventory.slice(0, 10).map((item) => (
                    <tr key={item._id} className="border-b">
                      <td className="py-2">{item.roomName}</td>
                      <td className="py-2">{item.itemName}</td>
                      <td
                        className={`py-2 font-semibold ${
                          item.condition === "Good"
                            ? "text-green-600"
                            : item.condition === "Damaged" ||
                                item.condition === "Needs Repair"
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {item.condition}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {popupVisible && (
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
