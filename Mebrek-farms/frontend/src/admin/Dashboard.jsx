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
} from "recharts";

import { fetchDashboardData } from "../services/dashboardService";

export default function Dashboard() {
  const [data, setData] = useState({
    orders: [],
    workers: [],
    production: [],
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await fetchDashboardData();
      setData(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Analytics
  const totalOrders = data.orders.length;
  const totalWorkers = data.workers.length;

  const totalEggs = data.production.reduce(
    (sum, item) => sum + (item.eggsCollected || 0),
    0
  );

  const revenue = totalEggs * 160;

  const productionChart = data.production.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString(),
    eggs: p.eggsCollected,
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

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      {/* PAGE HEADER */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Farm Analytics Dashboard 🚜
        </h1>

        <p className="text-gray-600 mt-2">
          Monitor farm operations in real-time
        </p>
      </div>

      {/* STATS CARDS */}
      <div className="grid md:grid-cols-4 gap-6 mb-10">

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-gray-500">Total Orders</h2>
          <p className="text-4xl font-bold text-green-600 mt-2">
            {totalOrders}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-gray-500">Farm Workers</h2>
          <p className="text-4xl font-bold text-blue-600 mt-2">
            {totalWorkers}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-gray-500">Eggs Produced</h2>
          <p className="text-4xl font-bold text-yellow-500 mt-2">
            {totalEggs}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-gray-500">Estimated Revenue</h2>
          <p className="text-4xl font-bold text-purple-600 mt-2">
            ₦{revenue.toLocaleString()}
          </p>
        </div>

      </div>

      {/* CHARTS */}
      <div className="grid md:grid-cols-2 gap-6 mb-10">

        {/* PRODUCTION CHART */}
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-2xl font-bold mb-4">
            Egg Production Trend 🥚
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productionChart}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="eggs"
                stroke="#16a34a"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* WORKERS VS ORDERS */}
        <div className="bg-white p-6 rounded-2xl shadow">
          <h2 className="text-2xl font-bold mb-4">
            Farm Overview 📊
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={workerChart}
                dataKey="value"
                outerRadius={100}
                label
              >
                <Cell fill="#16a34a" />
                <Cell fill="#2563eb" />
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* RECENT ORDERS */}
      <div className="bg-white rounded-2xl shadow p-6">

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            Recent Orders 📦
          </h2>
        </div>

        {data.orders.length === 0 ? (
          <p>No orders yet</p>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full">

              <thead>
                <tr className="border-b text-left">
                  <th className="py-3">Customer</th>
                  <th>Email</th>
                  <th>Message</th>
                  <th>Date</th>
                </tr>
              </thead>

              <tbody>
                {data.orders.slice(0, 10).map((order) => (
                  <tr
                    key={order._id}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="py-3">{order.name}</td>

                    <td>{order.email || "N/A"}</td>

                    <td>{order.message}</td>

                    <td>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>

            </table>

          </div>
        )}

      </div>
    </div>
  );
}
