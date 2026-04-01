import { Outlet, Link } from "react-router-dom";

export default function AdminLayout() {
  return (
    <div className="flex">
      {/* Sidebar */}
      <div className="w-64 bg-green-700 text-white min-h-screen p-5">
        <h2 className="text-xl font-bold mb-6">í°” Farm Panel</h2>

        <nav className="space-y-4">
          <Link to="/admin" className="block">Dashboard</Link>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <Outlet />
      </div>
    </div>
  );
}
