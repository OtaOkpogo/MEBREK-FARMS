import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import logo from "../assets/logo.png";
import GlobalSearch from "../components/GlobalSearch";
import NotificationPopup from "../components/NotificationPopup";
import socket from "../services/socket";

import notificationSound from "../assets/notification.mp3";
import orderSound from "../assets/order-notification.mp3";

import {
  markNotificationRead,
  replyNotification,
  getUnreadCount,
} from "../services/notificationService";

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    if (value._id) return value._id.toString();
    if (value.id) return value.id.toString();
  }

  return value.toString();
};

const isOwnSender = (senderId, userId) => {
  const sender = getId(senderId);
  const user = getId(userId);

  if (!sender || !user) return false;

  return sender === user;
};

// ============================================================
// ADMIN LAYOUT
// ============================================================

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // ==========================================================
  // USER
  // ==========================================================

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const role = user?.role || localStorage.getItem("role");

  const name = user?.name || localStorage.getItem("adminName");

  const currentUserId = getId(user?._id || user?.id);

  // ==========================================================
  // STATE
  // ==========================================================

  const [unreadOrders, setUnreadOrders] = useState(0);

  const [unreadMessages, setUnreadMessages] = useState(0);

  const [messageNotifications, setMessageNotifications] = useState([]);

  // ==========================================================
  // REFS
  // ==========================================================

  const orderAudioRef = useRef(null);

  const notificationAudioRef = useRef(null);

  const roleRef = useRef(role);

  const userIdRef = useRef(currentUserId);

  // ==========================================================
  // KEEP REFS CURRENT
  // ==========================================================

  useEffect(() => {
    roleRef.current = role;
    userIdRef.current = currentUserId;
  }, [role, currentUserId]);

  // ==========================================================
  // INITIALIZE ORDER SOUND
  // ==========================================================

  useEffect(() => {
    orderAudioRef.current = new Audio(orderSound);

    orderAudioRef.current.preload = "auto";

    orderAudioRef.current.volume = 1;

    return () => {
      if (orderAudioRef.current) {
        orderAudioRef.current.pause();
        orderAudioRef.current = null;
      }
    };
  }, []);

  // ==========================================================
  // INITIALIZE NOTIFICATION SOUND
  // ==========================================================

  useEffect(() => {
    notificationAudioRef.current = new Audio(notificationSound);

    notificationAudioRef.current.preload = "auto";

    notificationAudioRef.current.volume = 1;

    return () => {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause();
        notificationAudioRef.current = null;
      }
    };
  }, []);

  // ==========================================================
  // PLAY NOTIFICATION SOUND
  // ==========================================================

  const playNotificationSound = () => {
    try {
      if (!notificationAudioRef.current) {
        return;
      }

      notificationAudioRef.current.currentTime = 0;

      const playPromise = notificationAudioRef.current.play();

      if (playPromise?.catch) {
        playPromise.catch((err) => {
          console.warn("Notification sound was blocked by browser:", err);
        });
      }
    } catch (err) {
      console.warn("Notification sound error:", err);
    }
  };

  // ==========================================================
  // PLAY ORDER SOUND
  // ==========================================================

  const playOrderSound = () => {
    try {
      if (!orderAudioRef.current) {
        return;
      }

      orderAudioRef.current.currentTime = 0;

      const playPromise = orderAudioRef.current.play();

      if (playPromise?.catch) {
        playPromise.catch(() => {});
      }
    } catch (err) {
      console.warn("Order sound error:", err);
    }
  };

  // ==========================================================
  // REFRESH UNREAD NOTIFICATION COUNT
  // ==========================================================

  const refreshUnreadCount = async () => {
    if (roleRef.current === "staff") {
      setUnreadMessages(0);
      return;
    }

    try {
      const res = await getUnreadCount();

      console.log("UNREAD COUNT RESPONSE:", res);

      /*
       * apiClient returns the complete Axios
       * response.
       *
       * Backend returns:
       *
       * {
       *   count: 3
       * }
       *
       * Therefore:
       *
       * res.data.count
       */

      const count = res?.data?.count ?? res?.count ?? 0;

      setUnreadMessages(Number(count) || 0);
    } catch (err) {
      console.error("Failed to refresh unread notification count:", err);
    }
  };

  // ==========================================================
  // INITIAL UNREAD COUNT
  // ==========================================================

  useEffect(() => {
    refreshUnreadCount();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================
  // ORDER PAGE
  // ==========================================================

  useEffect(() => {
    if (location.pathname === "/admin/orders") {
      setUnreadOrders(0);
    }
  }, [location.pathname]);

  // ==========================================================
  // IMPORTANT:
  //
  // DO NOT CLEAR unreadMessages just because
  // the Notifications page was opened.
  //
  // The backend controls read/unread state.
  // ==========================================================

  // ==========================================================
  // NEW ORDER SOCKET
  // ==========================================================

  useEffect(() => {
    const handleNewOrder = (order) => {
      console.log("🔥 New Order Received", order);

      setUnreadOrders((prev) => prev + 1);

      playOrderSound();

      toast.success(`🛒 New order received from ${order?.name || "customer"}`, {
        position: "top-right",
        autoClose: 5000,
        pauseOnHover: true,
        theme: "colored",
      });

      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Mebrek Farms", {
            body: `New order received from ${order?.name || "customer"}`,
            icon: "/favicon.ico",
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission();
        }
      }

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

  // ==========================================================
  // NOTIFICATION SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (roleRef.current === "staff") {
      return;
    }

    // ========================================================
    // NEW NOTIFICATION
    // ========================================================

    const handleCreated = async (notification) => {
      console.log("🔔 notificationCreated:", notification);

      if (!notification) {
        return;
      }

      const isOwnMessage = isOwnSender(
        notification.senderId,
        userIdRef.current,
      );

      /*
       * Always refresh the backend count.
       *
       * This is important because unread state is
       * stored in readBy on the server.
       */
      await refreshUnreadCount();

      /*
       * Do not notify the sender about their
       * own message.
       */
      if (isOwnMessage) {
        return;
      }

      /*
       * Play sound for incoming messages.
       *
       * This happens even if the user is already
       * on the Notifications page.
       */
      playNotificationSound();

      /*
       * If user is currently on Notifications,
       * don't show the floating popup.
       *
       * The unread count still comes from backend.
       */
      if (location.pathname === "/admin/notifications") {
        return;
      }

      toast.info(`🔔 New message from ${notification.senderName || "User"}`, {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });

      setMessageNotifications((prev) => {
        const notificationId = getId(notification);

        const index = prev.findIndex((item) => getId(item) === notificationId);

        if (index === -1) {
          return [...prev, notification];
        }

        const next = [...prev];

        next[index] = notification;

        return next;
      });
    };

    // ========================================================
    // UPDATED NOTIFICATION
    // ========================================================

    const handleUpdated = async (notification) => {
      console.log("🔔 notificationUpdated:", notification);

      if (!notification) {
        return;
      }

      const isOwnMessage = isOwnSender(
        notification.senderId,
        userIdRef.current,
      );

      await refreshUnreadCount();

      /*
       * For a superadmin, an update may be caused
       * by the superadmin's own reply.
       *
       * Do not play a sound for your own action.
       */
      if (isOwnMessage) {
        return;
      }

      /*
       * Incoming update = new message from
       * the other participant.
       */
      playNotificationSound();

      if (location.pathname === "/admin/notifications") {
        return;
      }

      if (roleRef.current === "superadmin") {
        toast.info(
          `🔔 New message from ${notification.senderName || "Manager"}`,
          {
            position: "top-right",
            autoClose: 4000,
            theme: "colored",
          },
        );
      } else {
        toast.success("Super Admin replied to your message", {
          position: "top-right",
          autoClose: 4000,
          theme: "colored",
        });
      }

      setMessageNotifications((prev) => {
        const notificationId = getId(notification);

        const index = prev.findIndex((item) => getId(item) === notificationId);

        if (index === -1) {
          return [...prev, notification];
        }

        const next = [...prev];

        next[index] = notification;

        return next;
      });
    };

    socket.on("notificationCreated", handleCreated);

    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);

      socket.off("notificationUpdated", handleUpdated);
    };

    // location.pathname is intentionally included
    // so popup behavior follows the current page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ==========================================================
  // CLOSE POPUP
  // ==========================================================

  const handlePopupClose = () => {
    setMessageNotifications([]);
  };

  // ==========================================================
  // MARK POPUP MESSAGE READ
  // ==========================================================

  const handlePopupMarkRead = async (id) => {
    try {
      await markNotificationRead(id);

      await refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setMessageNotifications((prev) =>
        prev.filter((notification) => getId(notification) !== getId(id)),
      );
    }
  };

  // ==========================================================
  // REPLY FROM POPUP
  // ==========================================================

  const handlePopupReply = async (id, message) => {
    try {
      await replyNotification(id, {
        message,
      });

      await refreshUnreadCount();

      setMessageNotifications((prev) =>
        prev.filter((notification) => getId(notification) !== getId(id)),
      );
    } catch (err) {
      console.error("Failed to reply to notification:", err);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

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

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* ================================================== */}
      {/* SIDEBAR */}
      {/* ================================================== */}

      <aside className="w-72 bg-green-800 text-white p-6 shadow-lg">
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

        <div className="bg-green-700 rounded-lg p-4 mb-6">
          <p className="font-semibold text-lg">{name || "User"}</p>

          <p className="text-green-200 text-sm">
            Logged in as {role || "staff"}
          </p>
        </div>

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

        <nav className="space-y-2">
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
            to="/admin/flocks"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Flocks 🐔
          </Link>

          {["superadmin", "manager", "staff"].includes(role) && (
            <Link
              to="/admin/production"
              className="block hover:bg-green-700 p-3 rounded-lg transition"
            >
              Production 🥚
            </Link>
          )}

          <Link
            to="/admin/attendance"
            className="block hover:bg-green-700 p-3 rounded-lg transition"
          >
            Attendance 📅
          </Link>

          {/* ================================================= */}
          {/* NOTIFICATIONS */}
          {/* ================================================= */}

          <Link
            to="/admin/notifications"
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

          {["superadmin", "manager"].includes(role) && (
            <>
              <hr className="border-green-600 my-4" />

              <div className="text-green-200 text-xs uppercase tracking-wider mb-2">
                Management
              </div>

              <Link
                to="/admin/reports"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Reports 📊
              </Link>

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

              <Link
                to="/admin/egg-sales"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Egg Sales 🥚
              </Link>

              <Link
                to="/admin/manure-sales"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Manure Sales 🌾
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

      {/* ================================================== */}
      {/* MAIN */}
      {/* ================================================== */}

      <main className="flex-1 min-w-0 bg-gray-100 overflow-y-auto">
        <div className="bg-white shadow-sm px-8 py-4 flex items-center justify-between">
          <div className="w-full max-w-xl">
            <GlobalSearch />
          </div>

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

        <div className="w-full min-w-0 p-8">
          <Outlet />
        </div>
      </main>

      {/* ================================================== */}
      {/* NOTIFICATION POPUP */}
      {/* ================================================== */}

      <NotificationPopup
        notifications={messageNotifications}
        onClose={handlePopupClose}
        onMarkRead={handlePopupMarkRead}
        onReply={handlePopupReply}
      />

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
