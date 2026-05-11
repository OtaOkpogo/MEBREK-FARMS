import { Outlet, Link, useNavigate } from "react-router-dom";

import logo from "../assets/logo.png";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside
        className="
          w-72
          bg-green-800
          text-white
          p-6
          shadow-lg
        "
      >
        {/* LOGO + TITLE */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="logo"
              className="
                w-14
                h-14
                object-contain
                rounded-full
                bg-white
                p-1
              "
            />

            <div>
              <h2 className="text-2xl font-bold">Mebrek Farms</h2>

              <p className="text-green-200 text-sm">Farm Management System</p>
            </div>
          </div>
        </div>

        {/* BACK TO MAIN WEBSITE */}
        <button
          onClick={() => navigate("/")}
          className="
            w-full
            bg-white
            text-green-800
            font-semibold
            py-3
            rounded-lg
            mb-4
            hover:bg-gray-200
            transition
          "
        >
          ← Back to Farm Website
        </button>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="
            w-full
            bg-red-500
            text-white
            py-3
            rounded-lg
            mb-8
            hover:bg-red-600
            transition
          "
        >
          Logout
        </button>

        {/* NAVIGATION */}
        <nav className="space-y-3">
          <Link
            to="/admin"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Dashboard 📊
          </Link>

          <Link
            to="/admin/orders"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Orders 📦
          </Link>

          <Link
            to="/admin/workers"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Workers 👨‍🌾
          </Link>

          <Link
            to="/admin/production"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Production 🥚
          </Link>

          <Link
            to="/admin/feeds"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Feed Inventory 🌽
          </Link>

          <Link
            to="/admin/feed-invoices"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Feed Invoices 🧾
          </Link>

          <Link
            to="/admin/warehouse"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Warehouse 🏬
          </Link>

          <Link
            to="/admin/vaccinations"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Vaccinations 💉
          </Link>

          <Link
            to="/admin/bird-health"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Bird Health 🐔
          </Link>

          <Link
            to="/admin/medications"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Medications 💊
          </Link>

          <Link
            to="/admin/mortality"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Mortality Tracking ☠️
          </Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className="
          flex-1
          p-8
          bg-gray-100
          text-black
          overflow-y-auto
        "
      >
        <Outlet />
      </main>
    </div>
  );
}
