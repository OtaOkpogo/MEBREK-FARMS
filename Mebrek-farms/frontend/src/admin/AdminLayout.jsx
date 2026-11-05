import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";

import {
  LayoutDashboard,
  ShoppingBag,
  Bird,
  Egg,
  CalendarDays,
  Bell,
  Syringe,
  HeartPulse,
  Pill,
  Activity,
  BarChart3,
  Wallet,
  Users,
  MessageSquare,
  Wheat,
  FileText,
  Warehouse,
  BedDouble,
  UserCog,
  Database,
  ClipboardList,
  Globe,
  LogOut,
  User,
  ChevronDown,
  Menu,
  X,
  Calendar,
  Settings,
  CheckCheck,
  ArrowRight,
} from "lucide-react";

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

// ============================================================
// HELPERS
// ============================================================

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

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (error) {
    console.error("Unable to read saved user information:", error);
    return {};
  }
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

  const systemPaths = [
    "/admin/staff",
    "/admin/backup",
    "/admin/login-activity",
  ];

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

const getPageTitle = (pathname) => {
  const pages = [
    ["/admin", "Dashboard"],
    ["/admin/orders", "Orders"],
    ["/admin/flocks", "Flock Management"],
    ["/admin/production", "Poultry Production"],
    ["/admin/attendance", "Attendance"],
    ["/admin/notifications", "Notifications"],
    ["/admin/vaccinations", "Vaccinations"],
    ["/admin/bird-health", "Bird Health"],
    ["/admin/medications", "Medications"],
    ["/admin/mortality", "Mortality Tracking"],
    ["/admin/reports", "Farm Reports"],
    ["/admin/expenses", "Expenses"],
    ["/admin/workers", "Workers"],
    ["/admin/egg-sales", "Egg Sales"],
    ["/admin/customers", "Customers"],
    ["/admin/bulk-sms", "SMS Management"],
    ["/admin/manure-sales", "Manure Sales"],
    ["/admin/feeds", "Feed Inventory"],
    ["/admin/feed-invoices", "Feed Invoices"],
    ["/admin/warehouse", "Warehouse"],
    ["/admin/room-inventory", "Room Inventory"],
    ["/admin/staff", "Staff Accounts"],
    ["/admin/backup", "System Backup"],
    ["/admin/login-activity", "Login Activity"],
    ["/admin/profile", "My Profile"],
  ];

  const matched = pages.find(([path]) => {
    if (path === "/admin") return pathname === path;

    return pathname === path || pathname.startsWith(`${path}/`);
  });

  return matched?.[1] || "Farm Management";
};

// ============================================================
// SMALL COMPONENTS
// ============================================================

function RedDot({ label }) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-red-400 ring-2 ring-red-200"
    />
  );
}

function MenuSectionHeader({ id, children, expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={`admin-nav-${id}`}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-green-700/60 bg-green-800 px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-green-50 transition hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
    >
      <span>{children}</span>

      <ChevronDown
        size={17}
        className={`transition-transform duration-200 ${
          expanded ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

function NavigationLink({
  to,
  icon: Icon,
  children,
  badge,
  onClick,
  end = false,
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200 ${
          isActive
            ? "border-green-400/40 bg-green-600 font-semibold text-white shadow-sm"
            : "border-transparent text-green-100 hover:border-green-600/50 hover:bg-green-700/70 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex min-w-0 items-center gap-3">
            <Icon
              size={18}
              strokeWidth={isActive ? 2.5 : 1.8}
              className="shrink-0"
            />
            <span className="truncate">{children}</span>
          </span>

          {badge}
        </>
      )}
    </NavLink>
  );
}

// ============================================================
// NOTIFICATION CENTRE
// ============================================================

function NotificationCentre({
  notificationTotal,
  unreadOrders,
  unreadMessages,
  saleAccessBadges,
  role,
  onNavigate,
}) {
  return (
    <div
      role="dialog"
      aria-label="Notification centre"
      className="fixed right-4 top-16 z-[9999] w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-[#E1E9DE] bg-white text-left shadow-2xl sm:right-6"
    >
      <div className="flex items-center justify-between border-b border-[#E8EEE5] bg-[#F4F8F2] px-4 py-4">
        <div>
          <h2 className="font-bold text-[#294B36]">Notification Centre</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Your farm management updates
          </p>
        </div>

        <span className="rounded-full bg-[#DCEBDD] px-2.5 py-1 text-xs font-bold text-[#24583D]">
          {notificationTotal} new
        </span>
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-2">
        {unreadOrders > 0 && (
          <button
            type="button"
            onClick={() => onNavigate("/admin/orders", "orders")}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F2F7F0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
              <ShoppingBag size={19} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800">
                New Orders
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {unreadOrders} new order
                {unreadOrders === 1 ? "" : "s"} received
              </span>
            </span>

            <ArrowRight size={17} className="shrink-0 text-gray-400" />
          </button>
        )}

        {unreadMessages > 0 && (
          <button
            type="button"
            onClick={() => onNavigate("/admin/notifications", "messages")}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F2F7F0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <MessageSquare size={19} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800">
                Messages
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {unreadMessages} unread message
                {unreadMessages === 1 ? "" : "s"}
              </span>
            </span>

            <ArrowRight size={17} className="shrink-0 text-gray-400" />
          </button>
        )}

        {saleAccessBadges.egg && (
          <button
            type="button"
            onClick={() => onNavigate("/admin/egg-sales", "egg")}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F2F7F0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
              <Egg size={19} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800">
                Egg Sales Access
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {role === "superadmin"
                  ? "A pending access request needs review"
                  : "Your access request has been reviewed"}
              </span>
            </span>

            <ArrowRight size={17} className="shrink-0 text-gray-400" />
          </button>
        )}

        {saleAccessBadges.manure && (
          <button
            type="button"
            onClick={() => onNavigate("/admin/manure-sales", "manure")}
            className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#F2F7F0]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <Wheat size={19} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-gray-800">
                Manure Sales Access
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {role === "superadmin"
                  ? "A pending access request needs review"
                  : "Your access request has been reviewed"}
              </span>
            </span>

            <ArrowRight size={17} className="shrink-0 text-gray-400" />
          </button>
        )}

        {notificationTotal === 0 && (
          <div className="px-4 py-9 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF4EA] text-[#47734E]">
              <CheckCheck size={27} />
            </span>

            <h3 className="mt-3 text-sm font-bold text-gray-800">
              You're all caught up!
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              There are no new updates to show.
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-[#E8EEE5] bg-[#FAFCF9] px-4 py-3">
        <p className="text-center text-[11px] text-gray-500">
          Select an update to open its management page.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN LAYOUT
// ============================================================

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = getStoredUser();

  const rawRole = user?.role || localStorage.getItem("role") || "staff";
  const role = String(rawRole)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  const name = user?.name || localStorage.getItem("adminName");
  const currentUserId = getId(user?._id || user?.id);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationMenuOpen, setNotificationMenuOpen] = useState(false);

  const [unreadOrders, setUnreadOrders] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messageNotifications, setMessageNotifications] = useState([]);

  const [saleAccessBadges, setSaleAccessBadges] = useState({
    egg: false,
    manure: false,
  });

  const [expandedSections, setExpandedSections] = useState({
    general: true,
    management: false,
    system: false,
  });

  const orderAudioRef = useRef(null);
  const notificationAudioRef = useRef(null);
  const notificationMenuRef = useRef(null);

  const roleRef = useRef(role);
  const userIdRef = useRef(currentUserId);

  const pageTitle = getPageTitle(location.pathname);

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ==========================================================
  // NOTIFICATION COUNTS AND ACTIONS
  // ==========================================================

  const canSeeNotifications = ["superadmin", "manager"].includes(role);

  const notificationTotal =
    unreadOrders +
    (canSeeNotifications ? unreadMessages : 0) +
    (canSeeNotifications && saleAccessBadges.egg ? 1 : 0) +
    (canSeeNotifications && saleAccessBadges.manure ? 1 : 0);

  const closeNotificationMenu = () => {
    setNotificationMenuOpen(false);
  };

  const openNotificationDestination = (path, type) => {
    if (type === "orders") {
      setUnreadOrders(0);
    }

    closeNotificationMenu();
    navigate(path);
  };

  // Close notification dropdown when clicking outside it.
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setNotificationMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, []);

  // ==========================================================
  // NAVIGATION STATE
  // ==========================================================

  useEffect(() => {
    const activeSection = getActiveSection(location.pathname);

    setExpandedSections((previous) => ({
      ...previous,
      [activeSection]: true,
    }));

    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
    setNotificationMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setProfileMenuOpen(false);
        setNotificationMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const toggleSection = (section) => {
    setExpandedSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  const handleNavClick = (event) => {
    if (event.target.closest("a")) {
      setMobileMenuOpen(false);
    }
  };

  const sectionContentClass = (section) =>
    expandedSections[section]
      ? "flex flex-col gap-1.5 overflow-hidden pl-2 pt-1"
      : "hidden";

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
        new CustomEvent("saleAccessRequestCreated", { detail: request }),
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
        new CustomEvent("saleAccessRequestReviewed", { detail: request }),
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

  // ==========================================================
  // SIDEBAR BADGES
  // ==========================================================

  const orderBadge =
    unreadOrders > 0 ? (
      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
        {unreadOrders > 99 ? "99+" : unreadOrders}
      </span>
    ) : null;

  const messageBadge =
    unreadMessages > 0 ? (
      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white">
        {unreadMessages > 99 ? "99+" : unreadMessages}
      </span>
    ) : null;

  // ============================================================
  // SIDEBAR CONTENT
  // ============================================================

  const SidebarContent = (
    <>
      <div className="mb-7 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={logo}
            alt="Mebrek Farms logo"
            className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1.5 shadow-sm"
          />

          <div className="min-w-0">
            <h2 className="truncate text-xl font-extrabold tracking-tight text-white">
              Mebrek Farms
            </h2>
            <p className="text-xs text-green-200">Farm Management System</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-green-100 transition hover:bg-green-700 md:hidden"
        >
          <X size={21} />
        </button>
      </div>

      <div className="mb-5 flex items-center justify-between rounded-xl border border-green-700 bg-green-900/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-green-300">Signed in as</p>
          <p className="mt-0.5 break-words font-semibold text-white">
            {name || "User"}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
            role === "superadmin"
              ? "bg-amber-300 text-green-950"
              : role === "manager"
                ? "bg-blue-200 text-blue-900"
                : "bg-green-200 text-green-900"
          }`}
        >
          {role || "staff"}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            navigate("/");
          }}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-green-600 bg-green-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-600"
        >
          <Globe size={15} />
          Farm Website
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>

      <nav onClick={handleNavClick} className="flex flex-col gap-4">
        <section className="flex min-w-0 flex-col gap-2">
          <MenuSectionHeader
            id="general"
            expanded={expandedSections.general}
            onToggle={() => toggleSection("general")}
          >
            General
          </MenuSectionHeader>

          <div
            id="admin-nav-general"
            className={sectionContentClass("general")}
          >
            <NavigationLink to="/admin" end icon={LayoutDashboard}>
              Dashboard
            </NavigationLink>

            <NavigationLink
              to="/admin/orders"
              icon={ShoppingBag}
              onClick={() => setUnreadOrders(0)}
              badge={orderBadge}
            >
              Orders
            </NavigationLink>

            <NavigationLink to="/admin/flocks" icon={Bird}>
              Flocks
            </NavigationLink>

            <NavigationLink to="/admin/production" icon={Egg}>
              Production
            </NavigationLink>

            <NavigationLink to="/admin/attendance" icon={CalendarDays}>
              Attendance
            </NavigationLink>

            {canSeeNotifications && (
              <NavigationLink
                to="/admin/notifications"
                icon={Bell}
                badge={messageBadge}
              >
                Notifications
              </NavigationLink>
            )}

            <NavigationLink to="/admin/vaccinations" icon={Syringe}>
              Vaccinations
            </NavigationLink>

            <NavigationLink to="/admin/bird-health" icon={HeartPulse}>
              Bird Health
            </NavigationLink>

            <NavigationLink to="/admin/medications" icon={Pill}>
              Medications
            </NavigationLink>

            <NavigationLink to="/admin/mortality" icon={Activity}>
              Mortality Tracking
            </NavigationLink>
          </div>
        </section>

        {canSeeNotifications && (
          <section className="flex min-w-0 flex-col gap-2">
            <MenuSectionHeader
              id="management"
              expanded={expandedSections.management}
              onToggle={() => toggleSection("management")}
            >
              Management
            </MenuSectionHeader>

            <div
              id="admin-nav-management"
              className={sectionContentClass("management")}
            >
              <NavigationLink to="/admin/reports" icon={BarChart3}>
                Reports
              </NavigationLink>

              {role === "superadmin" && (
                <>
                  <NavigationLink to="/admin/expenses" icon={Wallet}>
                    Expenses
                  </NavigationLink>

                  <NavigationLink to="/admin/workers" icon={Users}>
                    Workers
                  </NavigationLink>
                </>
              )}

              <NavigationLink
                to="/admin/egg-sales"
                icon={Egg}
                badge={
                  saleAccessBadges.egg ? (
                    <RedDot label="Unread Egg Sales access notification" />
                  ) : null
                }
              >
                Egg Sales
              </NavigationLink>

              <NavigationLink to="/admin/customers" icon={Users}>
                Customers
              </NavigationLink>

              <NavigationLink to="/admin/bulk-sms" icon={MessageSquare}>
                SMS Management
              </NavigationLink>

              <NavigationLink
                to="/admin/manure-sales"
                icon={Wheat}
                badge={
                  saleAccessBadges.manure ? (
                    <RedDot label="Unread Manure Sales access notification" />
                  ) : null
                }
              >
                Manure Sales
              </NavigationLink>

              <NavigationLink to="/admin/feeds" icon={Wheat}>
                Feed Inventory
              </NavigationLink>

              <NavigationLink to="/admin/feed-invoices" icon={FileText}>
                Feed Invoices
              </NavigationLink>

              <NavigationLink to="/admin/warehouse" icon={Warehouse}>
                Warehouse
              </NavigationLink>

              <NavigationLink to="/admin/room-inventory" icon={BedDouble}>
                Room Inventory
              </NavigationLink>
            </div>
          </section>
        )}

        {/* SYSTEM ADMINISTRATION - SUPERADMIN ONLY */}
        {role === "superadmin" && (
          <section className="flex min-w-0 flex-col gap-2">
            <MenuSectionHeader
              id="system"
              expanded={expandedSections.system}
              onToggle={() => toggleSection("system")}
            >
              System Administration
            </MenuSectionHeader>

            <div
              id="admin-nav-system"
              className={sectionContentClass("system")}
            >
              <NavigationLink to="/admin/staff" icon={UserCog}>
                Staff Accounts
              </NavigationLink>

              <NavigationLink to="/admin/login-activity" icon={ClipboardList}>
                Login Activity
              </NavigationLink>

              <NavigationLink to="/admin/backup" icon={Database}>
                Backup
              </NavigationLink>
            </div>
          </section>
        )}
      </nav>

      <div className="mt-8 border-t border-green-700/70 pt-4 text-center">
        <p className="text-[11px] text-green-300">
          Mebrek Farms Management System
        </p>
        <p className="mt-1 text-[10px] text-green-400">
          Farm operations made easier
        </p>
      </div>
    </>
  );

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <div className="min-h-screen bg-[#F4F6F1] md:flex">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-gray-950/50 backdrop-blur-[2px] md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(88vw,20rem)] shrink-0 flex-col overflow-y-auto bg-[#24583D] p-5 text-white shadow-2xl transition-transform duration-300 ease-in-out md:sticky md:top-0 md:z-20 md:h-screen md:w-72 md:translate-x-0 md:shadow-none ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin navigation"
      >
        {SidebarContent}
      </aside>

      <main className="min-h-screen min-w-0 flex-1 bg-[#F4F6F1]">
        <header className="sticky top-0 z-30 border-b border-[#E3E9E0] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                  aria-expanded={mobileMenuOpen}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DCE6DA] bg-[#EDF3EB] text-[#24583D] transition hover:bg-[#DDEADB] md:hidden"
                >
                  <Menu size={21} />
                </button>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#78917D]">
                    Mebrek Farms / Administration
                  </p>

                  <h1 className="truncate text-lg font-extrabold text-[#294B36] sm:text-xl">
                    {pageTitle}
                  </h1>
                </div>
              </div>

              <div className="hidden items-center gap-2 text-right sm:flex">
                <Calendar size={17} className="text-[#78917D]" />
                <span className="text-xs font-medium text-gray-500">
                  {today}
                </span>
              </div>

              {/* NOTIFICATION BELL AND DROPDOWN */}
              {canSeeNotifications && (
                <div
                  className="relative z-[100] shrink-0"
                  ref={notificationMenuRef}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationMenuOpen((previous) => !previous);
                    }}
                    aria-label="Open notifications"
                    aria-expanded={notificationMenuOpen}
                    aria-haspopup="dialog"
                    className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                      notificationMenuOpen
                        ? "border-[#B7D0B5] bg-[#E8F0E6] text-[#24583D]"
                        : "border-[#DCE6DA] bg-white text-[#45634B] hover:bg-[#F1F6EF]"
                    }`}
                  >
                    <Bell size={20} />

                    {notificationTotal > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
                        {notificationTotal > 99 ? "99+" : notificationTotal}
                      </span>
                    )}
                  </button>

                  {notificationMenuOpen && (
                    <NotificationCentre
                      notificationTotal={notificationTotal}
                      unreadOrders={unreadOrders}
                      unreadMessages={unreadMessages}
                      saleAccessBadges={saleAccessBadges}
                      role={role}
                      onNavigate={openNotificationDestination}
                    />
                  )}
                </div>
              )}

              {/* PROFILE DROPDOWN */}
              <div className="relative z-[90] shrink-0">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((previous) => !previous)}
                  aria-expanded={profileMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open profile menu"
                  className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE6DA] bg-[#F4F8F2] px-2.5 text-[#24583D] transition hover:bg-[#E8F0E6]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DCEBDD]">
                    <User size={18} />
                  </span>

                  <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
                    {name || "User"}
                  </span>

                  <ChevronDown
                    size={15}
                    className={`transition-transform ${
                      profileMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {profileMenuOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close profile menu"
                      onClick={() => setProfileMenuOpen(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />

                    <div
                      role="menu"
                      className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-[#E1E9DE] bg-white shadow-xl"
                    >
                      <div className="border-b border-[#E9EEE6] bg-[#F4F8F2] px-4 py-4">
                        <p className="truncate font-bold text-[#294B36]">
                          {name || "User"}
                        </p>
                        <p className="mt-1 text-xs capitalize text-gray-500">
                          {role || "staff"}
                        </p>
                      </div>

                      <div className="p-2">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            navigate("/admin/profile");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-[#EDF4EA] hover:text-[#24583D]"
                        >
                          <User size={17} />
                          My Profile
                        </button>

                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            navigate("/admin/profile");
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-[#EDF4EA] hover:text-[#24583D]"
                        >
                          <Settings size={17} />
                          Account Settings
                        </button>

                        <div className="my-2 border-t border-gray-100" />

                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <LogOut size={17} />
                          Logout
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SEARCH AND WELCOME */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full min-w-0 sm:max-w-xl">
                <GlobalSearch />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#78917D] sm:hidden">
                <Calendar size={15} />
                <span>{today}</span>
              </div>

              <p className="hidden text-xs font-medium text-[#78917D] lg:block">
                Welcome back, {name || "User"}. Here's your farm workspace.
              </p>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="w-full min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* EXISTING MESSAGE POPUP */}
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
