import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
        orders: res?.orders ?? [],

        workers: res?.workers ?? [],

        production: res?.production ?? [],

        feeds: res?.feeds ?? [],
      });
    } catch (err) {
      console.error(err);

      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  // ================= DATA =================

  const orders = data.orders || [];

  const workers = data.workers || [];

  const production = data.production || [];

  const feeds = data.feeds || [];

  // ================= ANALYTICS =================

  const totalOrders = orders.length;

  const totalWorkers = workers.length;

  const totalEggs = production.reduce(
    (sum, item) => sum + (item?.eggsCollected || 0),

    0,
  );

  const revenue = totalEggs * 160;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + (item?.stock || 0),

    0,
  );

  // ================= CHART DATA =================

  const productionChart = production.map((p) => ({
    date: p?.createdAt ? new Date(p.createdAt).toLocaleDateString() : "N/A",

    eggs: p?.eggsCollected || 0,
  }));

  const workerChart = [
    {
      name: "Workers",
      value: totalWorkers,
    },

    {
      name: "Orders",
      value: totalOrders,
    },
  ];

  const inventoryChart = feeds.map((f) => ({
    name: f?.feedName || "Unknown",

    stock: f?.stock || 0,
  }));

  // ================= PERFORMANCE =================

  const workerPerformance = workers.map((worker) => ({
    name: worker?.name || "Unknown",

    performance: worker?.performance || Math.floor(Math.random() * 100),
  }));

  const COLORS = ["#16a34a", "#22c55e"];

  // ================= STATES =================

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div
        className="
          p-6
          text-red-600
        "
      >
        {error}
      </div>
    );
  }

  // ================= UI =================

  return (
    <div
      className="
        p-6
        bg-gray-100
        min-h-screen
      "
    >
      {/* HEADER */}

      <div className="mb-8">
        <h1
          className="
            text-4xl
            font-bold
            text-green-700
          "
        >
          Farm Analytics Dashboard 🚜
        </h1>

        <p className="text-gray-600 mt-2">
          Monitor farm activities in real-time
        </p>
      </div>

      {/* ANALYTICS CARDS */}

      <div
        className="
          grid
          md:grid-cols-4
          gap-6
          mb-10
        "
      >
        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-6
          "
        >
          <h2 className="text-gray-500">Orders</h2>

          <p
            className="
              text-4xl
              font-bold
              text-green-600
              mt-2
            "
          >
            {totalOrders}
          </p>
        </div>

        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-6
          "
        >
          <h2 className="text-gray-500">Workers</h2>

          <p
            className="
              text-4xl
              font-bold
              text-blue-600
              mt-2
            "
          >
            {totalWorkers}
          </p>
        </div>

        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-6
          "
        >
          <h2 className="text-gray-500">Eggs Produced</h2>

          <p
            className="
              text-4xl
              font-bold
              text-yellow-500
              mt-2
            "
          >
            {totalEggs}
          </p>
        </div>

        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-6
          "
        >
          <h2 className="text-gray-500">Revenue</h2>

          <p
            className="
              text-4xl
              font-bold
              text-purple-600
              mt-2
            "
          >
            ₦{revenue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* CHARTS */}

      <div
        className="
          grid
          md:grid-cols-2
          gap-6
          mb-10
        "
      >
        {/* PRODUCTION */}

        <div
          className="
            bg-white
            p-6
            rounded-2xl
            shadow
          "
        >
          <h2
            className="
              text-2xl
              font-bold
              mb-4
            "
          >
            Egg Production 🥚
          </h2>

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

        {/* FARM OVERVIEW */}

        <div
          className="
            bg-white
            p-6
            rounded-2xl
            shadow
          "
        >
          <h2
            className="
              text-2xl
              font-bold
              mb-4
            "
          >
            Farm Overview 📊
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={workerChart} dataKey="value" outerRadius={100} label>
                {workerChart.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FEED INVENTORY */}

      <div
        className="
          bg-white
          p-6
          rounded-2xl
          shadow
          mb-10
        "
      >
        <h2
          className="
            text-2xl
            font-bold
            mb-4
          "
        >
          Feed Inventory 🌽
        </h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={inventoryChart}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Legend />

            <Bar dataKey="stock" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>

        <p className="mt-4 font-bold">Total Feed Stock: {totalFeedStock}</p>
      </div>

      {/* WORKER PERFORMANCE */}

      <div
        className="
          bg-white
          p-6
          rounded-2xl
          shadow
          mb-10
        "
      >
        <h2
          className="
            text-2xl
            font-bold
            mb-6
          "
        >
          Worker Performance 📈
        </h2>

        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={workerPerformance}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Legend />

            <Bar dataKey="performance" fill="#2563eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
