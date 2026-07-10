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

export default function Dashboard() {
  const [data, setData] = useState({
    orders: [],
    workers: [],
    production: [],
    feeds: [],
    attendance: [],
    mortality: [],
    RoomInventory: [],
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

  const estimatedRevenue = totalEggs * 5000;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );

  const totalMortality = mortality.reduce(
    (sum, item) => sum + Number(item.numberDead || 0),
    0,
  );
  console.log("Mortality Records:", mortality);
  console.log("Total Mortality:", totalMortality);
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

  const farmOverview = [
    {
      name: "Orders",
      value: totalOrders,
    },
    {
      name: "Workers",
      value: totalWorkers,
    },
    {
      name: "Eggs",
      value: totalEggs,
    },
    {
      name: "Mortality",
      value: totalMortality,
    },
  ];

  const attendanceChart = [
    {
      name: "Present",
      value: presentCount,
    },
    {
      name: "Absent",
      value: absentCount,
    },
    {
      name: "Late",
      value: lateCount,
    },
  ];

  const roomChart = [
    {
      name: "Good",
      value: goodItems,
    },
    {
      name: "Damaged",
      value: damagedItems,
    },
    {
      name: "Missing",
      value: missingItems,
    },
  ];
  const COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626"];

  // ================= STATES =================

  if (loading) {
    return <div className="p-10 text-xl">Loading Dashboard...</div>;
  }

  if (error) {
    return <div className="p-10 text-red-600">{error}</div>;
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

      {/* KPI CARDS */}

      <div className="grid md:grid-cols-6 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Orders</h3>
          <p className="text-3xl font-bold text-green-600">{totalOrders}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Workers</h3>
          <p className="text-3xl font-bold text-blue-600">{totalWorkers}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Egg Production</h3>
          <p className="text-3xl font-bold text-yellow-500">{totalEggs}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Revenue</h3>
          <p className="text-3xl font-bold text-purple-600">
            ₦{estimatedRevenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Feed Stock</h3>
          <p className="text-3xl font-bold text-green-700">{totalFeedStock}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Mortality</h3>
          <p className="text-3xl font-bold text-red-600">{totalMortality}</p>
        </div>
      </div>
      {/* ROOM INVENTORY KPI */}

      <div className="grid md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Rooms</h3>

          <p className="text-3xl font-bold text-indigo-600">{totalRooms}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow">
          <h3 className="text-gray-500">Inventory Items</h3>

          <p className="text-3xl font-bold text-green-700">{totalRoomItems}</p>
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

      {/* FIRST ROW */}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">Egg Production Trend 🥚</h2>

          <ResponsiveContainer
            width="100%"
            height={300}
            minWidth={0}
            minHeight={200}
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

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">Farm Overview 📊</h2>

          <ResponsiveContainer
            width="100%"
            height={300}
            minWidth={0}
            minHeight={200}
          >
            <PieChart>
              <Pie data={farmOverview} dataKey="value" outerRadius={110} label>
                {farmOverview.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>

              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FEED INVENTORY */}

      <div className="bg-white p-6 rounded-2xl shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Feed Inventory 🌽</h2>

        <ResponsiveContainer
          width="100%"
          height={350}
          minWidth={0}
          minHeight={200}
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

      {/* ATTENDANCE + PERFORMANCE */}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">Attendance Analytics 📅</h2>

          <ResponsiveContainer
            width="100%"
            height={320}
            minWidth={0}
            minHeight={200}
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

        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">Worker Performance 📈</h2>

          <ResponsiveContainer
            width="100%"
            height={320}
            minWidth={0}
            minHeight={200}
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
      </div>

      {/* ROOM INVENTORY */}

      <div className="grid md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">Room Inventory Status 🏠</h2>

          <ResponsiveContainer
            width="100%"
            height={320}
            minWidth={0}
            minHeight={200}
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
