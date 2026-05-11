import { Outlet, Link } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}

      <aside className="w-64 bg-green-800 text-white p-6 shadow-lg">
        <h2 className="text-3xl font-bold mb-8">Mebrek Farms</h2>

        <nav className="space-y-4">
          <Link
            to="/admin"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Dashboard
          </Link>

          <Link
            to="/admin/orders"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Orders
          </Link>

          <Link
            to="/admin/workers"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Workers
          </Link>

          <Link
            to="/admin/production"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Production
          </Link>

          <Link
            to="/admin/feeds"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Feed Inventory
          </Link>

          <Link
            to="/admin/feed-invoices"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Feed Invoices
          </Link>

          <Link
            to="/admin/warehouse"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Warehouse
          </Link>

          <Link
            to="/admin/vaccinations"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Vaccinations
          </Link>

          <Link
            to="/admin/bird-health"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Bird Health
          </Link>

          <Link
            to="/admin/medications"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Medications
          </Link>

          <Link
            to="/admin/mortality"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Mortality
          </Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}

      <main className="flex-1 p-8 bg-gray-100 text-black overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
