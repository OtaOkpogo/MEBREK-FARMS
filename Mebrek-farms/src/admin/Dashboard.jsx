export default function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Farm Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card title="Eggs Today" value="12,450" />
        <Card title="Active Workers" value="18" />
        <Card title="Pending Orders" value="7" />
        <Card title="Flock Health" value="Good" />
      </div>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div className="bg-white p-4 rounded shadow">
      <p className="text-gray-500">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );
}
