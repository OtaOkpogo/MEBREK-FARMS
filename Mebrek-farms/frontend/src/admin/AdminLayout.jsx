import { useCallback, useEffect, useRef, useState } from "react";
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

import {
  fetchSaleAccessRequests as fetchEggAccessRequests,
  markSaleAccessRequestViewed as markEggRequestViewed,
} from "../services/eggSalesService";

import {
  fetchSaleAccessRequests as fetchManureAccessRequests,
  markSaleAccessRequestViewed as markManureRequestViewed,
} from "../services/manureSalesService";

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }

  return String(value);
};

const isOwnSender = (senderId, userId) => {
  const sender = getId(senderId);
  const user = getId(userId);

  return Boolean(sender && user && sender === user);
};

const normalizeRequests = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.requests)) return response.requests;
  return [];
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role || localStorage.getItem("role");
  const name = user?.name || localStorage.getItem("adminName");
  const currentUserId = getId(user?._id || user?.id);

  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageNotifications, setMessageNotifications] = useState([]);

  // Independent persistent indicators for the two sales sections.
  const [saleAccessBadges, setSaleAccessBadges] = useState({
    egg: false,
    manure: false,
  });

  const orderAudioRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const roleRef = useRef(role);
  const userIdRef = useRef(currentUserId);

  useEffect(() => {
    roleRef.current = role;
    userIdRef.current = currentUserId;
  }, [role, currentUserId]);

  // ==========================================================
  // AUTHENTICATED SOCKET CONNECTION
  // ==========================================================

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    socket.auth = (callback) => {
      callback({ token: localStorage.getItem("token") });
    };

    socket.disconnect();
    socket.connect();
  }, []);

  // ==========================================================
  // AUDIO
  // ==========================================================

  useEffect(() => {
    orderAudioRef.current = new Audio(orderSound);
    orderAudioRef.current.preload = "auto";
    orderAudioRef.current.volume = 1;

    return () => {
      orderAudioRef.current?.pause();
      orderAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    notificationAudioRef.current = new Audio(notificationSound);
    notificationAudioRef.current.preload = "auto";
    notificationAudioRef.current.volume = 1;

    return () => {
      notificationAudioRef.current?.pause();
      notificationAudioRef.current = null;
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = notificationAudioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      const result = audio.play();

      result?.catch?.((err) => {
        console.warn("Notification sound was blocked:", err);
      });
    } catch (err) {
      console.warn("Notification sound error:", err);
    }
  }, []);

  const playOrderSound = useCallback(() => {
    try {
      const audio = orderAudioRef.current;
      if (!audio) return;

      audio.currentTime = 0;
      const result = audio.play();

      result?.catch?.((err) => {
        console.warn("Order sound was blocked:", err);
      });
    } catch (err) {
      console.warn("Order sound error:", err);
    }
  }, []);

  // ==========================================================
  // EXISTING MESSAGE NOTIFICATIONS
  // ==========================================================

  const refreshUnreadCount = useCallback(async () => {
    if (roleRef.current === "staff") {
      setUnreadMessages(0);
      return;
    }

    try {
      const response = await getUnreadCount();
      const count = response?.data?.count ?? response?.count ?? 0;
      setUnreadMessages(Number(count) || 0);
    } catch (err) {
      console.error("Failed to refresh unread notification count:", err);
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // ==========================================================
  // SALE-ACCESS BADGES
  // ==========================================================

  const refreshSaleAccessBadges = useCallback(async () => {
    if (!["superadmin", "manager"].includes(roleRef.current)) {
      setSaleAccessBadges({ egg: false, manure: false });
      return;
    }

    try {
      const [eggResponse, manureResponse] = await Promise.all([
        fetchEggAccessRequests(),
        fetchManureAccessRequests(),
      ]);

      const hasNotification = (response) => {
        const requests = normalizeRequests(response);

        if (roleRef.current === "superadmin") {
          return requests.some((item) => item.status === "pending");
        }

        return requests.some(
          (item) =>
            ["approved", "rejected"].includes(item.status) &&
            !item.requesterViewedAt,
        );
      };

      setSaleAccessBadges({
        egg: hasNotification(eggResponse),
        manure: hasNotification(manureResponse),
      });
    } catch (err) {
      console.error("Failed to refresh sale-access badges:", err);
    }
  }, []);

  useEffect(() => {
    refreshSaleAccessBadges();

    const handleListChanged = () => refreshSaleAccessBadges();

    window.addEventListener("saleAccessRequestListChanged", handleListChanged);

    window.addEventListener("saleAccessRequestViewed", handleListChanged);

    return () => {
      window.removeEventListener(
        "saleAccessRequestListChanged",
        handleListChanged,
      );

      window.removeEventListener("saleAccessRequestViewed", handleListChanged);
    };
  }, [refreshSaleAccessBadges, role]);

  // When a manager opens one sales section, mark only that section's
  // reviewed requests as viewed. The other section remains independent.
  useEffect(() => {
    if (role !== "manager") return;

    const saleType = location.pathname.startsWith("/admin/egg-sales")
      ? "egg"
      : location.pathname.startsWith("/admin/manure-sales")
        ? "manure"
        : null;

    if (!saleType) return;

    const getRequests =
      saleType === "egg" ? fetchEggAccessRequests : fetchManureAccessRequests;

    const markViewed =
      saleType === "egg" ? markEggRequestViewed : markManureRequestViewed;

    let cancelled = false;

    const markUnreadAsViewed = async () => {
      try {
        const response = await getRequests();
        const requests = normalizeRequests(response);

        const unread = requests.filter(
          (item) =>
            ["approved", "rejected"].includes(item.status) &&
            !item.requesterViewedAt,
        );

        await Promise.all(unread.map((item) => markViewed(item._id)));

        if (cancelled) return;

        window.dispatchEvent(
          new CustomEvent("saleAccessRequestViewed", {
            detail: { saleType },
          }),
        );

        await refreshSaleAccessBadges();
      } catch (err) {
        console.error("Failed to mark sale-access requests viewed:", err);
      }
    };

    markUnreadAsViewed();

    return () => {
      cancelled = true;
    };
  }, [role, location.pathname, refreshSaleAccessBadges]);

  // ==========================================================
  // ORDERS
  // ==========================================================

  useEffect(() => {
    if (location.pathname === "/admin/orders") {
      setUnreadOrders(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    const handleNewOrder = (order) => {
      setUnreadOrders((prev) => prev + 1);
      playOrderSound();

      const message = `New order received from ${order?.name || "customer"}`;

      toast.success(`🛒 ${message}`, {
        position: "top-right",
        autoClose: 5000,
        pauseOnHover: true,
        theme: "colored",
      });

      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Mebrek Farms", {
            body: message,
            icon: "/favicon.ico",
          });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().catch(() => {});
        }
      }

      window.dispatchEvent(new CustomEvent("orderCreated", { detail: order }));
    };

    socket.on("newOrder", handleNewOrder);

    return () => socket.off("newOrder", handleNewOrder);
  }, [playOrderSound]);

  // ==========================================================
  // SALE-ACCESS SOCKET.IO HANDLERS
  // ==========================================================

  useEffect(() => {
    if (!["superadmin", "manager"].includes(role)) return;

    const handleAccessRequestCreated = (request) => {
      if (roleRef.current !== "superadmin" || !request) return;

      if (["egg", "manure"].includes(request.saleType)) {
        setSaleAccessBadges((prev) => ({
          ...prev,
          [request.saleType]: true,
        }));
      }

      playNotificationSound();

      const invoice = request.invoiceNumber || "unknown";
      const requester = request.requesterName || "Manager";
      const message =
        request.message ||
        `${requester} requested older-sale access for invoice ${invoice}.`;

      toast.info(`🔐 ${message}`, {
        position: "top-right",
        autoClose: 8000,
        pauseOnHover: true,
        theme: "colored",
      });

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Mebrek Farms — Access Request", {
          body: message,
          icon: "/favicon.ico",
        });
      }

      window.dispatchEvent(
        new CustomEvent("saleAccessRequestCreated", {
          detail: request,
        }),
      );

      window.dispatchEvent(
        new CustomEvent("saleAccessRequestListChanged", {
          detail: { saleType: request.saleType },
        }),
      );
    };

    const handleAccessRequestReviewed = (request) => {
      if (roleRef.current !== "manager" || !request) return;

      if (getId(request.requesterId) !== userIdRef.current) return;

      if (!["approved", "rejected"].includes(request.status)) return;

      if (["egg", "manure"].includes(request.saleType)) {
        setSaleAccessBadges((prev) => ({
          ...prev,
          [request.saleType]: true,
        }));
      }

      playNotificationSound();

      const invoice = request.invoiceNumber || "unknown";
      const note = request.reviewNote ? ` Note: ${request.reviewNote}` : "";

      let message;

      if (request.status === "approved") {
        const expiry = request.accessExpiresAt
          ? new Date(request.accessExpiresAt).toLocaleTimeString()
          : null;

        message = `Access approved for invoice ${invoice}. Temporary access expires in two hours.${
          expiry ? ` Expiry time: ${expiry}.` : ""
        }`;

        toast.success(`🔓 ${message}`, {
          position: "top-right",
          autoClose: 8000,
          pauseOnHover: true,
          theme: "colored",
        });
      } else {
        message = `Access rejected for invoice ${invoice}.${note}`;

        toast.error(`🔒 ${message}`, {
          position: "top-right",
          autoClose: 8000,
          pauseOnHover: true,
          theme: "colored",
        });
      }

      window.dispatchEvent(
        new CustomEvent("saleAccessRequestReviewed", {
          detail: request,
        }),
      );

      window.dispatchEvent(
        new CustomEvent("saleAccessRequestListChanged", {
          detail: { saleType: request.saleType },
        }),
      );
    };

    socket.on("saleAccessRequestCreated", handleAccessRequestCreated);
    socket.on("saleAccessRequestReviewed", handleAccessRequestReviewed);

    return () => {
      socket.off("saleAccessRequestCreated", handleAccessRequestCreated);
      socket.off("saleAccessRequestReviewed", handleAccessRequestReviewed);
    };
  }, [role, playNotificationSound]);

  // ==========================================================
  // EXISTING NOTIFICATION SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (roleRef.current === "staff") return;

    const handleCreated = async (notification) => {
      if (!notification) return;

      const ownMessage = isOwnSender(notification.senderId, userIdRef.current);

      await refreshUnreadCount();

      if (ownMessage) return;

      playNotificationSound();

      if (location.pathname === "/admin/notifications") return;

      toast.info(`🔔 New message from ${notification.senderName || "User"}`, {
        position: "top-right",
        autoClose: 4000,
        theme: "colored",
      });

      setMessageNotifications((prev) => {
        const id = getId(notification);
        const index = prev.findIndex((item) => getId(item) === id);

        if (index === -1) return [...prev, notification];

        const next = [...prev];
        next[index] = notification;
        return next;
      });
    };

    const handleUpdated = async (notification) => {
      if (!notification) return;

      const ownMessage = isOwnSender(notification.senderId, userIdRef.current);

      await refreshUnreadCount();

      if (ownMessage) return;

      playNotificationSound();

      if (location.pathname === "/admin/notifications") return;

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
        const id = getId(notification);
        const index = prev.findIndex((item) => getId(item) === id);

        if (index === -1) return [...prev, notification];

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
  }, [location.pathname, playNotificationSound, refreshUnreadCount]);

  // ==========================================================
  // MESSAGE POPUP
  // ==========================================================

  const handlePopupClose = () => setMessageNotifications([]);

  const handlePopupMarkRead = async (id) => {
    try {
      await markNotificationRead(id);
      await refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    } finally {
      setMessageNotifications((prev) =>
        prev.filter((item) => getId(item) !== getId(id)),
      );
    }
  };

  const handlePopupReply = async (id, message) => {
    try {
      await replyNotification(id, { message });
      await refreshUnreadCount();

      setMessageNotifications((prev) =>
        prev.filter((item) => getId(item) !== getId(id)),
      );
    } catch (err) {
      console.error("Failed to reply to notification:", err);
    }
  };

  // ==========================================================
  // LOGOUT
  // ==========================================================

  const handleLogout = () => {
    socket.disconnect();

    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("adminName");
    localStorage.removeItem("user");

    navigate("/login");
  };

  const RedDot = ({ label }) => (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="h-3 w-3 shrink-0 rounded-full bg-red-500 ring-2 ring-red-300 animate-pulse"
    />
  );

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="flex min-h-screen bg-gray-100">
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
                className={`mt-3 inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                  role === "superadmin"
                    ? "bg-red-500"
                    : role === "manager"
                      ? "bg-blue-500"
                      : "bg-green-500"
                }`}
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
          className="w-full bg-white text-green-800 font-semibold py-3 rounded-lg mb-4 hover:bg-gray-200 transition"
        >
          ← Back to Farm Website
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white py-3 rounded-lg mb-8 hover:bg-red-600 transition"
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
            className="flex items-center justify-between hover:bg-green-700 p-3 rounded-lg transition relative"
          >
            <span>Orders 📦</span>
            {unreadOrders > 0 && (
              <span className="min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
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

          <Link
            to="/admin/notifications"
            className="flex items-center justify-between hover:bg-green-700 p-3 rounded-lg transition relative"
          >
            <span>Notifications 🔔</span>
            {unreadMessages > 0 && (
              <span className="min-w-[24px] h-6 px-2 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
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
                className="flex items-center justify-between hover:bg-green-700 p-3 rounded-lg transition"
              >
                <span>Egg Sales 🥚</span>
                {saleAccessBadges.egg && (
                  <RedDot label="Unread Egg Sales access notification" />
                )}
              </Link>

              <Link
                to="/admin/customers"
                className="block hover:bg-green-700 p-3 rounded-lg transition"
              >
                Customers 👥
              </Link>

              <Link
                to="/admin/manure-sales"
                className="flex items-center justify-between hover:bg-green-700 p-3 rounded-lg transition"
              >
                <span>Manure Sales 🌾</span>
                {saleAccessBadges.manure && (
                  <RedDot label="Unread Manure Sales access notification" />
                )}
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
              className="w-10 h-10 rounded-full bg-green-700 text-white flex items-center justify-center hover:bg-green-800 transition"
            >
              👤
            </button>
          </div>
        </div>

        <div className="w-full min-w-0 p-8">
          <Outlet />
        </div>
      </main>

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
