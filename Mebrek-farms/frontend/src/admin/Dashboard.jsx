import { useEffect, useState } from "react";

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
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
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
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ================= DATA =================

  const orders = data.orders;
  const workers = data.workers;
  const production = data.production;
  const feeds = data.feeds;
  const attendance = data.attendance;
  const mortality = data.mortality;

  // ================= KPI =================

  const totalOrders = orders.length;

  const totalWorkers = workers.length;

  const totalEggs = production.reduce(
    (sum, item) => sum + (item.eggsCollected || 0),
    0,
  );

  const estimatedRevenue = totalEggs * 160;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + (item.stock || 0),
    0,
  );

  const totalMortality = mortality.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

  // ================= ATTENDANCE =================

  const presentCount = attendance.filter((a) => a.status === "Present").length;

  const absentCount = attendance.filter((a) => a.status === "Absent").length;

  const lateCount = attendance.filter((a) => a.status === "Late").length;

  // ================= CHART DATA =================

  const productionChart = production.map((item) => ({
    date: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString()
      : "N/A",

    eggs: item.eggsCollected || 0,
  }));

  const inventoryChart = feeds.map((item) => ({
    name: item.feedName || "Feed",
    stock: item.stock || 0,
  }));

  const workerPerformance = workers.map((worker) => ({
    name: worker.name,
    performance: worker.performance || Math.floor(Math.random() * 100),
  }));

  const farmOverview = [
    {
      name: "Workers",
      value: totalWorkers,
    },
    {
      name: "Orders",
      value: totalOrders,
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

      {/* FIRST ROW */}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-xl font-bold mb-4">Egg Production Trend 🥚</h2>

          <ResponsiveContainer width="100%" height={300}>
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

          <ResponsiveContainer width="100%" height={300}>
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

        <ResponsiveContainer width="100%" height={350}>
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

          <ResponsiveContainer width="100%" height={320}>
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

          <ResponsiveContainer width="100%" height={320}>
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
    </div>
  );
}
