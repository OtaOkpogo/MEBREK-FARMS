import { Outlet, Link } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-primary text-white p-6">
        <h2 className="text-2xl font-bold mb-6">Farm Admin</h2>
        <nav className="space-y-3">
          <Link to="/admin" className="block">Dashboard</Link>
          <Link to="/admin/workers" className="block">Workers</Link>
          <Link to="/admin/production" className="block">Egg Production</Link>
          <Link to="/admin/orders" className="block">Orders</Link>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
