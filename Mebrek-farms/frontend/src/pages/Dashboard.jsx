import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { fetchDashboardData } from "../services/dashboardService";

export default function Dashboard() {
  const [dashboard, setDashboard] = useState({
    workers: [],
    orders: [],
    production: [],
    feeds: [],
    mortality: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await fetchDashboardData();

      setDashboard({
        workers: data?.workers || [],
        orders: data?.orders || [],
        production: data?.production || [],
        feeds: data?.feeds || [],
        mortality: data?.mortality || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center">Loading Dashboard...</div>;
  }

  const { workers, orders, production, feeds, mortality } = dashboard;

  // ==========================
  // KPI CALCULATIONS
  // ==========================

  const totalWorkers = workers.length;

  const totalOrders = orders.length;

  const totalFeedStock = feeds.reduce(
    (sum, item) => sum + (item.stock || 0),
    0,
  );

  const totalMortality = production.reduce(
    (sum, item) => sum + (item.mortality || 0),
    0,
  );

  const totalEggCrates = production.reduce(
    (sum, item) => sum + (item.eggCrates || 0),
    0,
  );

  const totalCrackedEggs = production.reduce(
    (sum, item) => sum + (item.crackedEggs || 0),
    0,
  );

  const averageProduction =
    production.length > 0
      ? (
          production.reduce(
            (sum, item) => sum + (item.productionPercentage || 0),
            0,
          ) / production.length
        ).toFixed(1)
      : 0;

  // ==========================
  // CHARTS
  // ==========================

  const productionTrend = production.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    crates: item.eggCrates || 0,
  }));

  const mortalityTrend = production.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    mortality: item.mortality || 0,
  }));

  const feedConsumption = production.map((item) => ({
    date: new Date(item.date).toLocaleDateString(),
    feed: item.feedBagsConsumed || 0,
  }));

  const overviewData = [
    {
      name: "Workers",
      value: totalWorkers,
    },
    {
      name: "Orders",
      value: totalOrders,
    },
  ];

  const COLORS = ["#16a34a", "#2563eb"];

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      {/* HEADER */}

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-green-700">
          Mebrek Farms Dashboard
        </h1>

        <p className="text-gray-600">Poultry Farm Management System</p>
      </div>

      {/* KPI CARDS */}

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card title="Workers" value={totalWorkers} />

        <Card title="Orders" value={totalOrders} />

        <Card title="Egg Crates" value={totalEggCrates} />

        <Card title="Feed Stock" value={totalFeedStock} />

        <Card title="Mortality" value={totalMortality} />

        <Card title="Production %" value={`${averageProduction}%`} />
      </div>

      {/* ROW 1 */}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow">
          <h2 className="font-bold mb-4">Egg Production Trend</h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={productionTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="crates"
                stroke="#16a34a"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <h2 className="font-bold mb-4">Farm Overview</h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={overviewData} dataKey="value" outerRadius={100} label>
                {overviewData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>

              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ROW 2 */}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow">
          <h2 className="font-bold mb-4">Mortality Trend</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mortalityTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="mortality" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <h2 className="font-bold mb-4">Feed Consumption</h2>

          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={feedConsumption}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="feed" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="mt-8 bg-white p-6 rounded-xl shadow">
        <h2 className="font-bold text-xl mb-4">Production Summary</h2>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            Total Egg Crates:
            <strong> {totalEggCrates}</strong>
          </div>

          <div>
            Cracked Eggs:
            <strong> {totalCrackedEggs}</strong>
          </div>

          <div>
            Average Production:
            <strong> {averageProduction}%</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h3 className="text-gray-500">{title}</h3>

      <p className="text-3xl font-bold text-green-700">{value}</p>
    </div>
  );
}
