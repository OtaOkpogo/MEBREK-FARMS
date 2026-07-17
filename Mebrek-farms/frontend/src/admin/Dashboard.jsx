import { useEffect, useState } from "react";
import {
  getNotifications,
  markNotificationRead,
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
// UI-layer mirror of the backend's ROLE_PERMISSIONS in routes/dashboard.js.
// The backend is the actual enforcement point — fields a role can't see
// are never sent in the response at all. This map only controls which
// cards/charts render, and should stay in sync with the backend copy.
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
    revenue: false, // revenue is superadmin-only per spec
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
    feedStock: true,
    mortality: false,
    attendance: true,
    roomInventory: true,
    workerPerformance: false,
  },
};

// Maps a count of visible cards to a balanced Tailwind grid-cols class
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

export default function Dashboard() {
  const [data, setData] = useState({
    orders: [],
    workers: [],
    production: [],
    feeds: [],
    attendance: [],
    mortality: [],
    roomInventory: [],
    estimatedRevenue: 0,
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [notificationShown, setNotificationShown] = useState(false);
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

      const res = await fetchDashboardData();

      setData({
        orders: res?.orders || [],
        workers: res?.workers || [],
        production: res?.production || [],
        feeds: res?.feeds || [],
        attendance: res?.attendance || [],
        mortality: res?.mortality || [],
        roomInventory: res?.roomInventory || [],
        // Backend only includes this field for roles permitted to see it.
        // Non-superadmins will get undefined here, hence the fallback.
        estimatedRevenue: res?.estimatedRevenue ?? 0,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async () => {
    try {
      const data = await getCurrentUser();
      setUser(data);
    } catch (err) {
      console.error(err);
    }
  };
  const checkNotifications = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");

      if (user.role !== "superadmin") return;

      const notifications = await getNotifications();

      const unread = (notifications || []).filter((n) => !n.isRead);

      if (unread.length > 0) {
        setUnreadNotifications(unread);
        setPopupVisible(true);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const markRead = async (id) => {
    try {
      await markNotificationRead(id);

      setUnreadNotifications((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  // ================= PERMISSIONS =================

  const role = user?.role || "staff";
  const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.staff;

  // ================= DATA =================

  const orders = data.orders;
  const workers = data.workers;
  const production = data.production;
  const feeds = data.feeds;
  const attendance = data.attendance;
  const mortality = data.mortality;
  const roomInventory = data.roomInventory || [];

  // ================= KPI =================

  const totalOrders = orders.length;

  const totalWorkers = workers.length;

  const totalEggs = production.reduce(
    (sum, item) => sum + Number(item.totalEggs || 0),
    0,
  );

  // Revenue now comes from the backend, computed only for permitted roles.
  // No client-side computation from totalEggs anymore.
  const estimatedRevenue = data.estimatedRevenue || 0;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const totalMortality = mortality.reduce(
    (sum, item) => sum + Number(item.numberDead || 0),
    0,
  );

  const totalRooms = new Set(roomInventory.map((item) => item.room)).size;

  const totalRoomItems = roomInventory.length;

  const damagedItems = roomInventory.filter(
    (item) => item.condition === "Damaged",
  ).length;

  const missingItems = roomInventory.filter(
    (item) => item.condition === "Missing",
  ).length;

  const goodItems = roomInventory.filter(
    (item) => item.condition === "Good",
  ).length;

  // ================= ATTENDANCE =================

  const presentCount = attendance.filter((a) => a.status === "Present").length;

  const absentCount = attendance.filter((a) => a.status === "Absent").length;

  const lateCount = attendance.filter((a) => a.status === "Late").length;

  // ================= CHART DATA =================

  const productionChart = production.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    eggs: Number(item.totalEggs || 0),
  }));

  const inventoryChart = feeds.map((item) => ({
    name: item.name,
    stock: Number(item.quantity || 0),
  }));

  const workerPerformance = workers.map((worker) => ({
    name: worker.name,
    performance: worker.performance || 0,
  }));

  // Farm Overview pie only includes metrics this role can see
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

  // ================= PERMISSION-DRIVEN KPI CARDS =================

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
      value: totalEggs,
      color: "text-yellow-500",
    },
    perms.revenue && {
      key: "revenue",
      label: "Revenue",
      value: `₦${estimatedRevenue.toLocaleString()}`,
      color: "text-purple-600",
    },
    perms.feedStock && {
      key: "feedStock",
      label: "Feed Stock",
      value: totalFeedStock,
      color: "text-green-700",
    },
    perms.mortality && {
      key: "mortality",
      label: "Mortality",
      value: totalMortality,
      color: "text-red-600",
    },
  ].filter(Boolean);

  // Which chart rows are visible, used to keep grids balanced
  const showEggTrend = perms.production;
  const showFarmOverview = farmOverview.length > 0;
  const row1Count = [showEggTrend, showFarmOverview].filter(Boolean).length;

  const showAttendance = perms.attendance;
  const showWorkerPerf = perms.workerPerformance;
  const row2Count = [showAttendance, showWorkerPerf].filter(Boolean).length;

  // ================= STATES =================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>

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
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* HEADER */}

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Mebrek Farms Dashboard 🚜
        </h1>

        <p className="text-gray-600 mt-2">Farm Operations Monitoring Center</p>
      </div>

      {/* USER PROFILE CARD */}

      <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
        <h2 className="text-3xl font-bold text-green-700">
          Welcome back {user?.name || "User"} 👋
        </h2>

        <p className="text-gray-500 mt-2">Farm Management Dashboard</p>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {/* ROLE */}

          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-gray-500 text-sm">Role</p>

            <p className="font-bold text-lg uppercase">
              {user?.role || "staff"}
            </p>
          </div>

          {/* STATUS */}

          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-gray-500 text-sm">Status</p>

            <p
              className={`font-bold text-lg ${
                user?.status === "active" ? "text-green-600" : "text-red-600"
              }`}
            >
              {user?.status?.toUpperCase() || "ACTIVE"}
            </p>
          </div>

          {/* LAST LOGIN */}

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

      {/* KPI CARDS — permission-driven, grid auto-sizes to card count */}

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

      {/* ROOM INVENTORY KPI */}

      {perms.roomInventory && (
        <div className="grid md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Rooms</h3>

            <p className="text-3xl font-bold text-indigo-600">{totalRooms}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Inventory Items</h3>

            <p className="text-3xl font-bold text-green-700">
              {totalRoomItems}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Good Items</h3>

            <p className="text-3xl font-bold text-green-500">{goodItems}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Damaged</h3>

            <p className="text-3xl font-bold text-yellow-500">{damagedItems}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow">
            <h3 className="text-gray-500">Missing</h3>

            <p className="text-3xl font-bold text-red-600">{missingItems}</p>
          </div>
        </div>
      )}

      {/* FIRST ROW — Egg Trend + Farm Overview, grid balances to what's visible */}

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

      {/* FEED INVENTORY */}

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
              <Bar dataKey="stock" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ATTENDANCE + PERFORMANCE — grid balances to what's visible */}

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
                  <Bar dataKey="performance" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ROOM INVENTORY */}

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
                      <td className="py-2">{item.room}</td>

                      <td className="py-2">{item.itemName}</td>

                      <td
                        className={`py-2 font-semibold ${
                          item.condition === "Good"
                            ? "text-green-600"
                            : item.condition === "Damaged"
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

      {popupVisible && (
        <NotificationPopup
          notifications={unreadNotifications}
          onClose={() => setPopupVisible(false)}
          onMarkRead={markRead}
        />
      )}
    </div>
  );
}
