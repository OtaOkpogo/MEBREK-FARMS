import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import logo from "../assets/logo.png";
import GlobalSearch from "../components/GlobalSearch";
import socket from "../services/socket";
import orderSound from "../assets/order-notification.mp3";
import { FileBarChart2 } from "lucide-react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user?.role || localStorage.getItem("role");
  const name = user?.name || localStorage.getItem("adminName");

  const [unreadOrders, setUnreadOrders] = useState(0);

  const audioRef = useRef(null);

  // =============================
  // PRELOAD NOTIFICATION SOUND
  // =============================

  useEffect(() => {
    audioRef.current = new Audio(orderSound);
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1;
  }, []);

  // =============================
  // RESET BADGE WHEN VIEWING ORDERS
  // =============================

  useEffect(() => {
    if (location.pathname === "/admin/orders") {
      setUnreadOrders(0);
    }
  }, [location.pathname]);

  // =============================
  // SOCKET LISTENER
  // =============================

  useEffect(() => {
    const handleNewOrder = (order) => {
      console.log("🔥 New Order Received", order);
      // increment unread badge
      setUnreadOrders((prev) => prev + 1);

      // play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;

        audioRef.current.play().catch(() => {});
      }

      // toast
      toast.success(`🛒 New order received from ${order.name}`, {
        position: "top-right",
        autoClose: 5000,
        pauseOnHover: true,
        theme: "colored",
      });

      // Browser notification
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Mebrek Farms", {
            body: `New order received from ${order.name}`,
            icon: "/favicon.ico",
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      }

      // Notify Orders page if open
      window.dispatchEvent(
        new CustomEvent("orderCreated", {
          detail: order,
        }),
      );
    };

    socket.on("newOrder", handleNewOrder);

    return () => {
      socket.off("newOrder", handleNewOrder);
    };
  }, []);

  const handleLogout = () => {
    socket.off("newOrder");

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

              {/* ROLE BADGE */}
              <div
                className={`
                  mt-3
                  inline-block
                  px-3
                  py-1
                  rounded-full
                  text-sm
                  font-semibold
                  ${
                    role === "superadmin"
                      ? "bg-red-500"
                      : role === "manager"
                        ? "bg-blue-500"
                        : "bg-green-500"
                  }
                `}
              >
                {role?.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* USER INFO */}
        <div className="bg-green-700 rounded-lg p-4 mb-6">
          <p className="font-semibold text-lg">{name || "User"}</p>

          <p className="text-green-200 text-sm">
            Logged in as {role || "staff"}
          </p>
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
            onClick={() => setUnreadOrders(0)}
            className="
    flex
    items-center
    justify-between
    hover:bg-green-700
    p-3
    rounded-lg
    transition
    relative
  "
          >
            <span>Orders 📦</span>

            {unreadOrders > 0 && (
              <span
                className="
        min-w-[24px]
        h-6
        px-2
        rounded-full
        bg-red-500
        text-white
        text-xs
        font-bold
        flex
        items-center
        justify-center
        animate-pulse
      "
              >
                {unreadOrders > 99 ? "99+" : unreadOrders}
              </span>
            )}
          </Link>

          <Link
            to="/admin/attendance"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Attendance 📅
          </Link>

          {/* PRODUCTION - ALL ROLES */}
          {["superadmin", "manager", "staff"].includes(role) && (
            <Link
              to="/admin/production"
              className="block hover:bg-green-700 p-3 rounded-lg transition"
            >
              Production 🥚
            </Link>
          )}

          <Link
            to="/admin/notifications"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Notifications 🔔
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

          {/* MANAGEMENT */}
          {["superadmin", "manager"].includes(role) && (
            <>
              <hr className="border-green-600 my-4" />

              <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
                Management
              </div>

              {/* Reports — Manager + Super Admin only, per the reports
                  module's permissions table (Worker/Staff has no access) */}
              <Link
                to="/admin/reports"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Reports 📊
              </Link>

              {/* SUPER ADMIN ONLY */}
              {role === "superadmin" && (
                <>
                  <Link
                    to="/admin/expenses"
                    className="block hover:bg-green-700 p-3 rounded-lg transition"
                  >
                    Expenses 💰
                  </Link>

                  <Link
                    to="/admin/workers"
                    className="block hover:bg-green-700 p-3 rounded-lg transition"
                  >
                    Workers 👨‍🌾
                  </Link>
                </>
              )}

              {/* SUPER ADMIN + MANAGER */}
              <Link
                to="/admin/egg-sales"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Egg Sales 🥚
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
                to="/admin/room-inventory"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Room Inventory 🛏️
              </Link>
            </>
          )}

          {/* SUPERADMIN ONLY */}
          {role === "superadmin" && (
            <>
              <hr className="border-green-600 my-4" />

              <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
                System Administration
              </div>

              <Link
                to="/admin/staff"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Staff Accounts 👥
              </Link>

              <Link
                to="/admin/backup"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Backup 🗄️
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* MAIN AREA */}
      <main className="flex-1 min-w-0 bg-gray-100 overflow-y-auto">
        {/* TOP HEADER */}
        {/* TOP HEADER */}
        <div className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          {/* GLOBAL SEARCH */}
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>

          {/* USER */}
          <div className="flex items-center gap-3 ml-6">
            <div className="text-right">
              <p className="font-semibold">{name || "User"}</p>

              <p className="text-sm text-gray-500">{role || "staff"}</p>
            </div>

            <button
              onClick={() => navigate("/admin/profile")}
              className="
        w-10
        h-10
        rounded-full
        bg-green-700
        text-white
        flex
        items-center
        justify-center
        hover:bg-green-800
        transition
      "
            >
              👤
            </button>
          </div>
        </div>

        {/* PAGE CONTENT */}
        <div className="w-full min-w-0 p-8">
          <Outlet />
        </div>
      </main>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </div>
  );
}
