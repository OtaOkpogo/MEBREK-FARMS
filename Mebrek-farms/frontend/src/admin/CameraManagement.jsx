import { useEffect, useRef, useState } from "react";
import {
  Outlet,
  Link,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import logo from "../assets/logo.png";
import GlobalSearch from "../components/GlobalSearch";
import NotificationPopup from "../components/NotificationPopup";
import socket from "../services/socket";
import orderSound from "../assets/order-notification.mp3";

import {
  markNotificationRead,
  replyNotification,
  getUnreadCount,
} from "../services/notificationService";

import { FileBarChart2 } from "lucide-react";

const isOwnSender = (senderId, userId) => {
  if (!senderId || !userId) return false;

  const id = senderId?._id?.toString?.() || senderId?.toString?.();

  return id === userId?.toString();
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // =============================
  // CURRENT USER
  // =============================

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user?.role || localStorage.getItem("role");

  const name = user?.name || localStorage.getItem("adminName");

  // =============================
  // STATE
  // =============================

  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageNotifications, setMessageNotifications] = useState([]);

  // =============================
  // REFS
  // =============================

  const audioRef = useRef(null);
  const roleRef = useRef(role);
  const userIdRef = useRef(user?.id);

  // =============================
  // KEEP REFS UPDATED
  // =============================

  useEffect(() => {
    roleRef.current = role;
    userIdRef.current = user?.id;
  }, [role, user?.id]);

  // =============================
  // PRELOAD NOTIFICATION SOUND
  // =============================

  useEffect(() => {
    audioRef.current = new Audio(orderSound);
    audioRef.current.preload = "auto";
    audioRef.current.volume = 1;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // =============================
  // UNREAD MESSAGE COUNT
  // =============================

  const refreshUnreadCount = () => {
    // Staff has no access to notifications
    if (roleRef.current === "staff") {
      return;
    }

    getUnreadCount()
      .then((res) => {
        setUnreadMessages(res?.count ?? 0);
      })
      .catch((err) => {
        console.error("Failed to refresh unread notification count:", err);
      });
  };

  // =============================
  // INITIAL UNREAD COUNT
  // =============================

  useEffect(() => {
    refreshUnreadCount();
  }, []);

  // =============================
  // RESET ORDER BADGE
  // WHEN VIEWING ORDERS
  // =============================

  useEffect(() => {
    if (location.pathname === "/admin/orders") {
      setUnreadOrders(0);
    }
  }, [location.pathname]);

  // =============================
  // RESET MESSAGE BADGE
  // WHEN VIEWING NOTIFICATIONS
  // =============================

  useEffect(() => {
    if (location.pathname === "/admin/notifications") {
      setUnreadMessages(0);
    }
  }, [location.pathname]);

  // =============================
  // SOCKET LISTENER — ORDERS
  // =============================

  useEffect(() => {
    const handleNewOrder = (order) => {
      console.log("🔥 New Order Received", order);

      setUnreadOrders((prev) => prev + 1);

      // Play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;

        audioRef.current.play().catch(() => {});
      }

      // Toast notification
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

      // Notify other components
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

  // =============================
  // SOCKET LISTENER —
  // MESSAGE NOTIFICATIONS
  //
  // Manager <-> Super Admin inbox
  // =============================

  useEffect(() => {
    // Staff never receives notification inbox events
    if (roleRef.current === "staff") {
      return;
    }

    // =============================
    // NEW NOTIFICATION CREATED
    // =============================

    const handleCreated = (notification) => {
      // ALWAYS refresh the unread badge first.
      // This keeps the count accurate even when
      // popup-specific logic skips the notification.
      refreshUnreadCount();

      const isOwnMessage = isOwnSender(
        notification.senderId,
        userIdRef.current,
      );

      // Only Super Admin receives
      // new-message popup.
      if (isOwnMessage || roleRef.current !== "superadmin") {
        return;
      }

      // Don't stack a popup on top of
      // the Notifications page.
      if (location.pathname === "/admin/notifications") {
        return;
      }

      // Play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;

        audioRef.current.play().catch(() => {});
      }

      // Show toast
      toast.info(`🔔 New message from ${notification.senderName}`, {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });

      // Add/update popup notification
      setMessageNotifications((prev) => {
        const idx = prev.findIndex((n) => n._id === notification._id);

        if (idx === -1) {
          return [...prev, notification];
        }

        const next = [...prev];

        next[idx] = notification;

        return next;
      });
    };

    // =============================
    // NOTIFICATION UPDATED
    //
    // Typically triggered when
    // Super Admin replies to Manager
    // =============================

    const handleUpdated = (notification) => {
      // ALWAYS refresh the unread badge first.
      // This keeps the count accurate even when
      // popup-specific logic skips the notification.
      refreshUnreadCount();

      const isOwnThread = isOwnSender(notification.senderId, userIdRef.current);

      // Only the original sender,
      // typically Manager, gets reply popup.
      if (!isOwnThread || roleRef.current === "superadmin") {
        return;
      }

      // Don't stack popup on Notifications page.
      if (location.pathname === "/admin/notifications") {
        return;
      }

      // Play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;

        audioRef.current.play().catch(() => {});
      }

      // Show toast
      toast.success("Super Admin replied to your message", {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });

      // Update popup with latest thread
      setMessageNotifications((prev) => {
        const idx = prev.findIndex((n) => n._id === notification._id);

        if (idx === -1) {
          return [...prev, notification];
        }

        const next = [...prev];

        next[idx] = notification;

        return next;
      });
    };

    socket.on("notificationCreated", handleCreated);

    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);

      socket.off("notificationUpdated", handleUpdated);
    };

    // The location is intentionally included
    // because popup behavior depends on the
    // current page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // =============================
  // POPUP CLOSE
  // =============================

  const handlePopupClose = () => {
    setMessageNotifications([]);
  };

  // =============================
  // POPUP MARK AS READ
  // =============================

  const handlePopupMarkRead = async (id) => {
    try {
      await markNotificationRead(id);

      // Refresh badge after marking read
      refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setMessageNotifications((prev) => prev.filter((n) => n._id !== id));
    }
  };

  // =============================
  // POPUP REPLY
  // =============================

  const handlePopupReply = async (id, message) => {
    try {
      await replyNotification(id, {
        message,
      });

      // Refresh badge after reply
      refreshUnreadCount();

      setMessageNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Failed to reply to notification:", err);
    }
  };

  // =============================
  // LOGOUT
  // =============================

  const handleLogout = () => {
    socket.off("newOrder");

    socket.off("notificationCreated");

    socket.off("notificationUpdated");

    localStorage.removeItem("token");

    localStorage.removeItem("role");

    localStorage.removeItem("adminName");

    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* =============================
          SIDEBAR
      ============================== */}

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

        {/* =============================
            NAVIGATION
        ============================== */}

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

          {/* ORDERS */}

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

          {/* ATTENDANCE */}

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

          {/* NOTIFICATIONS */}

          <Link
            to="/admin/notifications"
            onClick={() => setUnreadMessages(0)}
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
            <span>Notifications 🔔</span>

            {unreadMessages > 0 && (
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
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </Link>

          {/* VACCINATIONS */}

          <Link
            to="/admin/vaccinations"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Vaccinations 💉
          </Link>

          {/* BIRD HEALTH */}

          <Link
            to="/admin/bird-health"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Bird Health 🐔
          </Link>

          {/* MEDICATIONS */}

          <Link
            to="/admin/medications"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Medications 💊
          </Link>

          {/* MORTALITY */}

          <Link
            to="/admin/mortality"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Mortality Tracking ☠️
          </Link>

          {/* =============================
              MANAGEMENT
          ============================== */}

          {["superadmin", "manager"].includes(role) && (
            <>
              <hr className="border-green-600 my-4" />

              <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
                Management
              </div>

              {/* REPORTS */}

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

              {role === "superadmin" && (
                <NavLink
                  to="/cctv"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? "bg-green-600 text-white"
                        : "text-gray-700 hover:bg-green-100"
                    }`
                  }
                >
                  <span className="text-xl">📹</span>
                  <span>Farm CCTV</span>
                </NavLink>
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

          {/* =============================
              SUPER ADMIN ONLY
          ============================== */}

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

      {/* =============================
          MAIN AREA
      ============================== */}

      <main className="flex-1 min-w-0 bg-gray-100 overflow-y-auto">
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

      {/* =============================
          MESSAGE NOTIFICATION POPUP
      ============================== */}

      <NotificationPopup
        notifications={messageNotifications}
        onClose={handlePopupClose}
        onMarkRead={handlePopupMarkRead}
        onReply={handlePopupReply}
      />

      {/* =============================
          TOAST CONTAINER
      ============================== */}

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
