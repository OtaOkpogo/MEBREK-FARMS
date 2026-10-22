import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";

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

const getActiveSection = (pathname) => {
  const managementPaths = [
    "/admin/reports",
    "/admin/expenses",
    "/admin/workers",
    "/admin/egg-sales",
    "/admin/customers",
    "/admin/bulk-sms",
    "/admin/manure-sales",
    "/admin/feeds",
    "/admin/feed-invoices",
    "/admin/warehouse",
    "/admin/room-inventory",
  ];

  const systemPaths = ["/admin/staff", "/admin/backup"];

  if (
    managementPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return "management";
  }

  if (
    systemPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return "system";
  }

  return "general";
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

  const [saleAccessBadges, setSaleAccessBadges] = useState({
    egg: false,
    manure: false,
  });

  // ==========================================================
  // COLLAPSIBLE NAVIGATION
  // ==========================================================

  const [expandedSections, setExpandedSections] = useState({
    general: true,
    management: false,
    system: false,
  });

  useEffect(() => {
    const activeSection = getActiveSection(location.pathname);

    setExpandedSections((previous) => ({
      ...previous,
      [activeSection]: true,
    }));
  }, [location.pathname]);

  const toggleSection = (section) => {
    setExpandedSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const orderAudioRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const roleRef = useRef(role);
  const userIdRef = useRef(currentUserId);

  useEffect(() => {
    roleRef.current = role;
    userIdRef.current = currentUserId;
  }, [role, currentUserId]);

  // ==========================================================
  // SOCKET CONNECTION
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

      audio.play()?.catch?.((err) => {
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

      audio.play()?.catch?.((err) => {
        console.warn("Order sound was blocked:", err);
      });
    } catch (err) {
      console.warn("Order sound error:", err);
    }
  }, []);

  // ==========================================================
  // MESSAGE NOTIFICATIONS
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
  // SALES ACCESS BADGES
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

  // ==========================================================
  // MARK SALES REQUESTS AS VIEWED
  // ==========================================================

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
      setUnreadOrders((previous) => previous + 1);
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
  // SALES ACCESS SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (!["superadmin", "manager"].includes(role)) return;

    const handleAccessRequestCreated = (request) => {
      if (roleRef.current !== "superadmin" || !request) return;

      if (["egg", "manure"].includes(request.saleType)) {
        setSaleAccessBadges((previous) => ({
          ...previous,
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
        setSaleAccessBadges((previous) => ({
          ...previous,
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
  // MESSAGE SOCKET EVENTS
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

      setMessageNotifications((previous) => {
        const id = getId(notification);
        const index = previous.findIndex((item) => getId(item) === id);

        if (index === -1) return [...previous, notification];

        const next = [...previous];
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

      setMessageNotifications((previous) => {
        const id = getId(notification);
        const index = previous.findIndex((item) => getId(item) === id);

        if (index === -1) return [...previous, notification];

        const next = [...previous];
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
      setMessageNotifications((previous) =>
        previous.filter((item) => getId(item) !== getId(id)),
      );
    }
  };

  const handlePopupReply = async (id, message) => {
    try {
      await replyNotification(id, { message });
      await refreshUnreadCount();

      setMessageNotifications((previous) =>
        previous.filter((item) => getId(item) !== getId(id)),
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
      className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500 ring-2 ring-red-300"
    />
  );

  // ==========================================================
  // SECTION HEADER
  // ==========================================================

  const SectionHeader = ({ id, children }) => {
    const isExpanded = Boolean(expandedSections[id]);

    return (
      <button
        type="button"
        onClick={() => toggleSection(id)}
        aria-expanded={isExpanded}
        aria-controls={`admin-nav-${id}`}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-green-600 bg-green-700 px-4 py-3 text-left text-sm font-bold uppercase tracking-wide text-white transition hover:bg-green-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span>{children}</span>

        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-green-800 text-sm transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
    );
  };

  // Use conditional display classes rather than the HTML hidden attribute.
  const sectionContentClass = (section) =>
    expandedSections[section]
      ? "flex flex-col gap-2 overflow-hidden pl-2"
      : "hidden";

  // NavLink supplies isActive, so this function returns a CSS string.
  const navLinkClass = ({ isActive }) =>
    `flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left transition ${
      isActive
        ? "border-green-400 bg-green-600 font-semibold text-white shadow-sm"
        : "border-transparent text-green-50 hover:border-green-600 hover:bg-green-700"
    }`;

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      <aside className="flex w-full shrink-0 flex-col self-start bg-green-800 p-5 text-white shadow-lg md:min-h-screen md:w-72">
        {/* BRAND */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Mebrek Farms logo"
              className="h-14 w-14 shrink-0 rounded-full bg-white object-contain p-1"
            />

            <div className="min-w-0">
              <h2 className="text-2xl font-bold">Mebrek Farms</h2>
              <p className="text-sm text-green-200">Farm Management System</p>

              <div
                className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${
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

        {/* USER DETAILS */}
        <div className="mb-4 rounded-lg border border-green-600 bg-green-700 p-4">
          <p className="break-words text-lg font-semibold">{name || "User"}</p>

          <p className="text-sm text-green-200">
            Logged in as {role || "staff"}
          </p>
        </div>

        {/* ACTION BUTTONS */}
        <div className="mb-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="min-h-11 w-full rounded-lg bg-white px-4 py-3 text-left font-semibold text-green-800 transition hover:bg-gray-200"
          >
            ← Back to Farm Website
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-11 w-full rounded-lg bg-red-500 px-4 py-3 text-left font-semibold text-white transition hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {/* VERTICAL NAVIGATION */}
        <nav className="flex flex-col gap-4">
          {/* GENERAL */}
          <section className="flex min-w-0 flex-col gap-2">
            <SectionHeader id="general">General</SectionHeader>

            <div
              id="admin-nav-general"
              className={sectionContentClass("general")}
            >
              <NavLink to="/admin" className={navLinkClass}>
                Dashboard 📊
              </NavLink>

              <NavLink
                to="/admin/orders"
                onClick={() => setUnreadOrders(0)}
                className={navLinkClass}
              >
                <span>Orders 📦</span>

                {unreadOrders > 0 && (
                  <span className="flex h-6 min-w-6 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                    {unreadOrders > 99 ? "99+" : unreadOrders}
                  </span>
                )}
              </NavLink>

              <NavLink to="/admin/flocks" className={navLinkClass}>
                Flocks 🐔
              </NavLink>

              {["superadmin", "manager", "staff"].includes(role) && (
                <NavLink to="/admin/production" className={navLinkClass}>
                  Production 🥚
                </NavLink>
              )}

              <NavLink to="/admin/attendance" className={navLinkClass}>
                Attendance 📅
              </NavLink>

              {["superadmin", "manager"].includes(role) && (
                <NavLink to="/admin/notifications" className={navLinkClass}>
                  <span>Notifications 🔔</span>

                  {unreadMessages > 0 && (
                    <span className="flex h-6 min-w-6 shrink-0 animate-pulse items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </NavLink>
              )}

              <NavLink to="/admin/vaccinations" className={navLinkClass}>
                Vaccinations 💉
              </NavLink>

              <NavLink to="/admin/bird-health" className={navLinkClass}>
                Bird Health 🐔
              </NavLink>

              <NavLink to="/admin/medications" className={navLinkClass}>
                Medications 💊
              </NavLink>

              <NavLink to="/admin/mortality" className={navLinkClass}>
                Mortality Tracking ☠️
              </NavLink>
            </div>
          </section>

          {/* MANAGEMENT */}
          {["superadmin", "manager"].includes(role) && (
            <section className="flex min-w-0 flex-col gap-2">
              <SectionHeader id="management">Management</SectionHeader>

              <div
                id="admin-nav-management"
                className={sectionContentClass("management")}
              >
                <NavLink to="/admin/reports" className={navLinkClass}>
                  Reports 📊
                </NavLink>

                {role === "superadmin" && (
                  <>
                    <NavLink to="/admin/expenses" className={navLinkClass}>
                      Expenses 💰
                    </NavLink>

                    <NavLink to="/admin/workers" className={navLinkClass}>
                      Workers 👨‍🌾
                    </NavLink>
                  </>
                )}

                <NavLink to="/admin/egg-sales" className={navLinkClass}>
                  <span>Egg Sales 🥚</span>

                  {saleAccessBadges.egg && (
                    <RedDot label="Unread Egg Sales access notification" />
                  )}
                </NavLink>

                <NavLink to="/admin/customers" className={navLinkClass}>
                  Customers 👥
                </NavLink>

                <NavLink to="/admin/bulk-sms" className={navLinkClass}>
                  SMS Management 📱
                </NavLink>

                <NavLink to="/admin/manure-sales" className={navLinkClass}>
                  <span>Manure Sales 🌾</span>

                  {saleAccessBadges.manure && (
                    <RedDot label="Unread Manure Sales access notification" />
                  )}
                </NavLink>

                <NavLink to="/admin/feeds" className={navLinkClass}>
                  Feed Inventory 🌽
                </NavLink>

                <NavLink to="/admin/feed-invoices" className={navLinkClass}>
                  Feed Invoices 🧾
                </NavLink>

                <NavLink to="/admin/warehouse" className={navLinkClass}>
                  Warehouse 🏬
                </NavLink>

                <NavLink to="/admin/room-inventory" className={navLinkClass}>
                  Room Inventory 🛏️
                </NavLink>
              </div>
            </section>
          )}

          {/* SYSTEM ADMINISTRATION */}
          {role === "superadmin" && (
            <section className="flex min-w-0 flex-col gap-2">
              <SectionHeader id="system">System Administration</SectionHeader>

              <div
                id="admin-nav-system"
                className={sectionContentClass("system")}
              >
                <NavLink to="/admin/staff" className={navLinkClass}>
                  Staff Accounts 👥
                </NavLink>

                <NavLink to="/admin/backup" className={navLinkClass}>
                  Backup 🗄️
                </NavLink>
              </div>
            </section>
          )}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="min-w-0 flex-1 overflow-y-auto bg-gray-100">
        <header className="flex flex-col gap-4 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="w-full min-w-0 max-w-xl">
            <GlobalSearch />
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="min-w-0 text-right">
              <p className="break-words font-semibold">{name || "User"}</p>
              <p className="text-sm text-gray-500">{role || "staff"}</p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/profile")}
              aria-label="Open profile"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-700 text-white transition hover:bg-green-800"
            >
              👤
            </button>
          </div>
        </header>

        <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
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
