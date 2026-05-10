import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function InventoryChart({
  inventory,
}) {

  // BAR CHART DATA

  const barData = inventory.map((item) => ({
    name: item.feedName,
    stock: item.stock,
  }));


  // PIE CHART DATA

  const pieData = inventory.map((item) => ({
    name: item.feedName,
    value: item.stock,
  }));


  const COLORS = [
    "#16a34a",
    "#22c55e",
    "#4ade80",
    "#86efac",
    "#15803d",
  ];


  return (
    <div className="grid lg:grid-cols-2 gap-6">

      {/* BAR CHART */}

      <div className="bg-white p-6 rounded-2xl shadow">

        <h2 className="text-xl font-bold mb-4">
          📦 Feed Stock Levels
        </h2>

        <ResponsiveContainer
          width="100%"
          height={300}
        >
          <BarChart data={barData}>

            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Bar
              dataKey="stock"
              radius={[8, 8, 0, 0]}
            />

          </BarChart>
        </ResponsiveContainer>
      </div>



      {/* PIE CHART */}

      <div className="bg-white p-6 rounded-2xl shadow">

        <h2 className="text-xl font-bold mb-4">
          🥘 Feed Distribution
        </h2>

        <ResponsiveContainer
          width="100%"
          height={300}
        >
          <PieChart>

            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              label
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    COLORS[
                      index % COLORS.length
                    ]
                  }
                />
              ))}
            </Pie>

            <Tooltip />

            <Legend />

          </PieChart>
        </ResponsiveContainer>

      </div>

    </div>
  );
}
