import { Outlet, Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function AdminLayout() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user?.role || localStorage.getItem("role");
  const name = user?.name || localStorage.getItem("adminName");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("adminName");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* SIDEBAR */}
      <aside className="w-72 bg-green-800 text-white p-6 shadow-lg">
        {/* LOGO */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="logo"
              className="w-14 h-14 object-contain rounded-full bg-white p-1"
            />

            <div>
              <h2 className="text-2xl font-bold">Mebrek Farms</h2>
              <p className="text-green-200 text-sm">Farm Management System</p>
            </div>
          </div>
        </div>

        {/* USER INFO */}
        <div className="bg-green-700 rounded-lg p-4 mb-6">
          <p className="font-semibold text-lg">{name || "User"}</p>

          <p className="text-green-200 text-sm uppercase">{role || "staff"}</p>
        </div>

        {/* BACK TO WEBSITE */}
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
        <nav className="space-y-2">
          {/* GENERAL */}
          <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
            General
          </div>

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
            to="/admin/attendance"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Attendance 📅
          </Link>

          <Link
            to="/admin/production"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Production 🥚
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

          {/* ADMIN ONLY */}
          {role === "admin" && (
            <>
              <hr className="border-green-600 my-4" />

              <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
                Administration
              </div>

              <Link
                to="/admin/workers"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Workers 👨‍🌾
              </Link>

              <Link
                to="/admin/expenses"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Expenses 💰
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
            </>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 bg-gray-100 text-black overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
