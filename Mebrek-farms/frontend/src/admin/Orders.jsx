import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import socket from "../services/socket";

const API = "http://localhost:5000/api";
const PAGE_SIZE = 10;

const STATUS_OPTIONS = ["Pending", "Contacted", "Completed", "Cancelled"];

const CONTACT_STATUS_OPTIONS = [
  "Not Scheduled",
  "Scheduled",
  "Contacted",
  "No Answer",
  "Reschedule",
  "Completed",
];

const STATUS_COLORS = {
  Pending: "bg-amber-100 text-amber-800",
  Contacted: "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-red-100 text-red-800",
};

const CONTACT_COLORS = {
  "Not Scheduled": "bg-gray-100 text-gray-700",
  Scheduled: "bg-indigo-100 text-indigo-800",
  Contacted: "bg-blue-100 text-blue-800",
  "No Answer": "bg-amber-100 text-amber-800",
  Reschedule: "bg-purple-100 text-purple-800",
  Completed: "bg-emerald-100 text-emerald-800",
};

const EMPTY_BOOKING = {
  customerId: "",
  name: "",
  contact: "",
  productType: "Eggs",
  quantity: "",
  quantityUnit: "crates",
  nextContactAt: "",
  collectionAt: "",
  bookingNotes: "",
};

const EMPTY_SCHEDULE = {
  nextContactAt: "",
  collectionAt: "",
  contactStatus: "Not Scheduled",
  bookingNotes: "",
};

const getToken = () => localStorage.getItem("token");

const authConfig = () => ({
  headers: {
    Authorization: `Bearer ${getToken()}`,
  },
});

const getOrderDate = (order) =>
  order.bookingAt || order.createdAt || order.updatedAt || null;

const getValidDate = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = getValidDate(value);

  return date ? date.toLocaleString() : "Not scheduled";
};

const toDateTimeLocal = (value) => {
  const date = getValidDate(value);

  if (!date) return "";

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const isClosedOrder = (order) =>
  ["Completed", "Cancelled"].includes(order.status);

const isContactComplete = (order) =>
  order.contactStatus === "Completed" || order.status === "Completed";

const isContactOverdue = (order) => {
  const date = getValidDate(order.nextContactAt);

  return Boolean(
    date &&
    date.getTime() <= Date.now() &&
    !isClosedOrder(order) &&
    !isContactComplete(order),
  );
};

const getSourceLabel = (order) =>
  order.source === "Manual"
    ? "Manual booking"
    : order.source === "Website"
      ? "Website"
      : order.source || "Website";

const formatBookingNumber = (order) => {
  const value = order?.bookingNumber;

  if (value === null || value === undefined || value === "") {
    return "Legacy record";
  }

  if (typeof value === "string" && /^[A-Za-z]+-/.test(value)) {
    return value.toUpperCase();
  }

  return `MF-${String(value).padStart(5, "0")}`;
};

/*
 * SERVICE QUEUE ORDERING
 *
 * Booking numbers determine the order of service.
 * If two records have the same number, or a record has no number,
 * the booking timestamp and database ID provide a fallback.
 */
const compareServiceOrder = (a, b) => {
  const rawA = a?.bookingNumber;
  const rawB = b?.bookingNumber;

  const numberA = Number(rawA);
  const numberB = Number(rawB);

  const hasNumberA =
    rawA !== null &&
    rawA !== undefined &&
    rawA !== "" &&
    Number.isFinite(numberA);

  const hasNumberB =
    rawB !== null &&
    rawB !== undefined &&
    rawB !== "" &&
    Number.isFinite(numberB);

  if (hasNumberA && hasNumberB && numberA !== numberB) {
    return numberA - numberB;
  }

  if (hasNumberA !== hasNumberB) {
    return hasNumberA ? -1 : 1;
  }

  const dateA = getValidDate(getOrderDate(a))?.getTime() ?? 0;
  const dateB = getValidDate(getOrderDate(b))?.getTime() ?? 0;

  if (dateA !== dateB) {
    return dateA - dateB;
  }

  return String(a?._id || "").localeCompare(String(b?._id || ""));
};

const getContactPriority = (order) => {
  if (isContactOverdue(order)) return 0;

  const nextContact = getValidDate(order.nextContactAt);

  if (nextContact && !isClosedOrder(order) && !isContactComplete(order)) {
    return 1;
  }

  if (!nextContact && !isClosedOrder(order) && !isContactComplete(order)) {
    return 2;
  }

  return 3;
};

const getPriorityLabel = (order) => {
  const priority = getContactPriority(order);

  if (priority === 0) return "OVERDUE";
  if (priority === 1) return "SCHEDULED";
  if (priority === 2) return "NEEDS SCHEDULING";

  return "LOW PRIORITY";
};

const getPriorityClass = (order) => {
  const priority = getContactPriority(order);

  if (priority === 0) return "bg-red-100 text-red-800";
  if (priority === 1) return "bg-blue-100 text-blue-800";
  if (priority === 2) return "bg-amber-100 text-amber-800";

  return "bg-slate-100 text-slate-600";
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);

  const [activeView, setActiveView] = useState("register");

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleOrder, setScheduleOrder] = useState(null);

  const [newBooking, setNewBooking] = useState({
    ...EMPTY_BOOKING,
  });

  const [newEnquiry, setNewEnquiry] = useState({
    name: "",
    contact: "",
    message: "",
  });

  const [scheduleForm, setScheduleForm] = useState({
    ...EMPTY_SCHEDULE,
  });

  // ------------------------------------------------------------
  // FETCH ORDERS
  // ------------------------------------------------------------

  const fetchOrders = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const response = await axios.get(`${API}/orders`, authConfig());

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.orders || [];

      setOrders(data);
    } catch (error) {
      console.error("Failed to load orders:", error);

      toast.error(
        error.response?.status === 401
          ? "Your session has expired. Please sign in again."
          : "Failed to load orders.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ------------------------------------------------------------
  // FETCH CUSTOMERS
  // ------------------------------------------------------------

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/customers`, authConfig());

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.customers || [];

      setCustomers(data.filter((customer) => customer.isActive !== false));
    } catch (error) {
      console.error("Failed to load customers:", error);

      toast.error(
        "Customer list could not be loaded. You can enter customer details manually.",
      );
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, [fetchOrders, fetchCustomers]);

  // ------------------------------------------------------------
  // REAL-TIME ORDER UPDATES
  // ------------------------------------------------------------

  useEffect(() => {
    const upsertOrder = (incoming) => {
      if (!incoming?._id) {
        fetchOrders(false);
        return;
      }

      setOrders((previous) => {
        const exists = previous.some((item) => item._id === incoming._id);

        if (exists) {
          return previous.map((item) =>
            item._id === incoming._id ? { ...item, ...incoming } : item,
          );
        }

        return [...previous, incoming];
      });
    };

    const handleNewOrder = (order) => {
      upsertOrder(order);

      if (order?.source !== "Manual") {
        toast.info(`New order received from ${order?.name || "a customer"}.`);
      }
    };

    const handleOrderDeleted = (payload) => {
      const id = payload?.id || payload?._id;

      if (!id) {
        fetchOrders(false);
        return;
      }

      setOrders((previous) => previous.filter((order) => order._id !== id));
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderBookingCreated", upsertOrder);
    socket.on("orderBookingUpdated", upsertOrder);
    socket.on("orderStatusUpdated", upsertOrder);
    socket.on("orderDeleted", handleOrderDeleted);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderBookingCreated", upsertOrder);
      socket.off("orderBookingUpdated", upsertOrder);
      socket.off("orderStatusUpdated", upsertOrder);
      socket.off("orderDeleted", handleOrderDeleted);
    };
  }, [fetchOrders]);

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------

  const chronologicalOrders = useMemo(
    () => [...orders].sort(compareServiceOrder),
    [orders],
  );

  const searchedOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return chronologicalOrders;

    return chronologicalOrders.filter((order) => {
      const searchable = [
        formatBookingNumber(order),
        order.bookingNumber,
        order.name,
        order.contact,
        order.message,
        order.status,
        order.contactStatus,
        order.productType,
        order.quantity,
        order.quantityUnit,
        order.bookingNotes,
        order.source,
        order.customer?.name,
        order.customer?.phone,
        order.customer?.email,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [chronologicalOrders, search]);

  // ------------------------------------------------------------
  // FIRST-COME, FIRST-SERVED SERVICE QUEUE
  // ------------------------------------------------------------

  const serviceQueue = useMemo(
    () =>
      orders.filter((order) => !isClosedOrder(order)).sort(compareServiceOrder),
    [orders],
  );

  // Queue positions are based on the complete active queue,
  // not just the results currently visible after searching.
  const serviceQueuePositions = useMemo(
    () => new Map(serviceQueue.map((order, index) => [order._id, index + 1])),
    [serviceQueue],
  );

  const searchedServiceQueue = useMemo(() => {
    const matchingIds = new Set(searchedOrders.map((order) => order._id));

    return serviceQueue.filter((order) => matchingIds.has(order._id));
  }, [serviceQueue, searchedOrders]);

  // ------------------------------------------------------------
  // CONTACT QUEUE
  // This is separate from the first-come, first-served queue.
  // ------------------------------------------------------------

  const contactQueue = useMemo(
    () =>
      [...searchedOrders]
        .filter((order) => !isClosedOrder(order) && !isContactComplete(order))
        .sort((a, b) => {
          const priorityDifference =
            getContactPriority(a) - getContactPriority(b);

          if (priorityDifference !== 0) {
            return priorityDifference;
          }

          const dateA = getValidDate(a.nextContactAt)?.getTime() ?? Infinity;

          const dateB = getValidDate(b.nextContactAt)?.getTime() ?? Infinity;

          if (dateA !== dateB) {
            return dateA - dateB;
          }

          return compareServiceOrder(a, b);
        }),
    [searchedOrders],
  );

  const displayedOrders =
    activeView === "service"
      ? searchedServiceQueue
      : activeView === "queue"
        ? contactQueue
        : searchedOrders;

  useEffect(() => {
    setPage(1);
  }, [search, activeView]);

  // ------------------------------------------------------------
  // DASHBOARD STATISTICS
  // ------------------------------------------------------------

  const stats = useMemo(
    () => ({
      total: orders.length,

      pending: orders.filter((order) => order.status === "Pending").length,

      scheduled: orders.filter(
        (order) =>
          Boolean(order.nextContactAt) &&
          !isClosedOrder(order) &&
          !isContactComplete(order),
      ).length,

      overdue: orders.filter(isContactOverdue).length,

      completed: orders.filter((order) => order.status === "Completed").length,

      unscheduled: orders.filter(
        (order) =>
          !order.nextContactAt &&
          !isClosedOrder(order) &&
          !isContactComplete(order),
      ).length,
    }),
    [orders],
  );

  const totalPages = Math.max(1, Math.ceil(displayedOrders.length / PAGE_SIZE));

  const paginatedOrders = displayedOrders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ------------------------------------------------------------
  // UPDATE ORDER STATUS
  // ------------------------------------------------------------

  const handleStatusChange = async (orderId, newStatus) => {
    const previousOrders = orders.map((order) => ({
      ...order,
    }));

    setUpdatingId(orderId);

    // Update immediately so the service queue reacts at once.
    setOrders((previous) =>
      previous.map((order) =>
        order._id === orderId ? { ...order, status: newStatus } : order,
      ),
    );

    try {
      await axios.put(
        `${API}/orders/${orderId}/status`,
        { status: newStatus },
        authConfig(),
      );

      toast.success("Order status updated.");

      await fetchOrders(false);
    } catch (error) {
      console.error("Failed to update status:", error);

      setOrders(previousOrders);

      toast.error(
        error.response?.data?.message || "Failed to update order status.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // ------------------------------------------------------------
  // ADVANCE BOOKING FORM
  // ------------------------------------------------------------

  const openBookingModal = () => {
    setNewBooking({ ...EMPTY_BOOKING });
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    if (!submitting) {
      setShowBookingModal(false);
    }
  };

  const handleBookingChange = (field, value) => {
    if (field === "customerId" && value) {
      const customer = customers.find((item) => item._id === value);

      if (customer) {
        setNewBooking((previous) => ({
          ...previous,
          customerId: value,
          name: customer.name || "",
          contact: customer.phone || customer.email || "",
        }));

        return;
      }
    }

    setNewBooking((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleCreateBooking = async (event) => {
    event.preventDefault();

    if (!newBooking.name.trim() || !newBooking.contact.trim()) {
      toast.error("Enter the customer's name and contact details.");
      return;
    }

    if (!newBooking.productType) {
      toast.error("Select the product being booked.");
      return;
    }

    if (!newBooking.quantity || Number(newBooking.quantity) <= 0) {
      toast.error("Enter a quantity greater than zero.");
      return;
    }

    if (!newBooking.quantityUnit.trim()) {
      toast.error("Enter the quantity unit.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customerId: newBooking.customerId || undefined,
        name: newBooking.name.trim(),
        contact: newBooking.contact.trim(),
        productType: newBooking.productType,
        quantity: Number(newBooking.quantity),
        quantityUnit: newBooking.quantityUnit.trim(),
        nextContactAt: newBooking.nextContactAt || null,
        collectionAt: newBooking.collectionAt || null,
        bookingNotes: newBooking.bookingNotes.trim(),
        message: `${newBooking.productType} advance booking: ${newBooking.quantity} ${newBooking.quantityUnit}`,
      };

      const response = await axios.post(
        `${API}/orders/booking`,
        payload,
        authConfig(),
      );

      const createdOrder = response.data?.order;

      if (createdOrder?._id) {
        setOrders((previous) => {
          const exists = previous.some(
            (order) => order._id === createdOrder._id,
          );

          return exists
            ? previous.map((order) =>
                order._id === createdOrder._id
                  ? { ...order, ...createdOrder }
                  : order,
              )
            : [...previous, createdOrder];
        });
      } else {
        await fetchOrders(false);
      }

      toast.success(
        `Advance booking recorded${
          createdOrder?.bookingNumber != null
            ? ` (${formatBookingNumber(createdOrder)})`
            : ""
        }.`,
      );

      setShowBookingModal(false);
      setNewBooking({ ...EMPTY_BOOKING });
    } catch (error) {
      console.error("Failed to create advance booking:", error);

      toast.error(
        error.response?.data?.message || "Failed to create advance booking.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // GENERAL ENQUIRY FORM
  // ------------------------------------------------------------

  const openEnquiryModal = () => {
    setNewEnquiry({
      name: "",
      contact: "",
      message: "",
    });

    setShowEnquiryModal(true);
  };

  const handleCreateEnquiry = async (event) => {
    event.preventDefault();

    if (
      !newEnquiry.name.trim() ||
      !newEnquiry.contact.trim() ||
      !newEnquiry.message.trim()
    ) {
      toast.error("Name, contact, and message are required.");
      return;
    }

    setSubmitting(true);

    try {
      // Keep the original website/enquiry API contract.
      const response = await axios.post(
        `${API}/orders`,
        {
          name: newEnquiry.name.trim(),
          contact: newEnquiry.contact.trim(),
          message: newEnquiry.message.trim(),
        },
        authConfig(),
      );

      const createdOrder = response.data?.order;

      if (createdOrder?._id) {
        setOrders((previous) => {
          const exists = previous.some(
            (order) => order._id === createdOrder._id,
          );

          return exists
            ? previous.map((order) =>
                order._id === createdOrder._id
                  ? { ...order, ...createdOrder }
                  : order,
              )
            : [...previous, createdOrder];
        });
      } else {
        await fetchOrders(false);
      }

      toast.success(
        `Customer enquiry added${
          createdOrder?.bookingNumber != null
            ? ` (${formatBookingNumber(createdOrder)})`
            : ""
        }.`,
      );

      setShowEnquiryModal(false);

      setNewEnquiry({
        name: "",
        contact: "",
        message: "",
      });
    } catch (error) {
      console.error("Failed to add enquiry:", error);

      toast.error(error.response?.data?.message || "Failed to add enquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------
  // CONTACT AND COLLECTION SCHEDULE
  // ------------------------------------------------------------

  const openScheduleModal = (order) => {
    setScheduleOrder(order);

    setScheduleForm({
      nextContactAt: toDateTimeLocal(order.nextContactAt),
      collectionAt: toDateTimeLocal(order.collectionAt),
      contactStatus:
        order.contactStatus ||
        (order.nextContactAt ? "Scheduled" : "Not Scheduled"),
      bookingNotes: order.bookingNotes || "",
    });

    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    if (scheduleSaving) return;

    setShowScheduleModal(false);
    setScheduleOrder(null);
  };

  const handleScheduleChange = (field, value) => {
    setScheduleForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSaveSchedule = async (event) => {
    event.preventDefault();

    if (!scheduleOrder?._id) return;

    setScheduleSaving(true);

    try {
      const payload = {
        nextContactAt: scheduleForm.nextContactAt || null,
        collectionAt: scheduleForm.collectionAt || null,
        contactStatus: scheduleForm.contactStatus,
        bookingNotes: scheduleForm.bookingNotes.trim(),
      };

      const response = await axios.put(
        `${API}/orders/${scheduleOrder._id}/booking-details`,
        payload,
        authConfig(),
      );

      const updatedOrder = response.data?.order || response.data;

      if (updatedOrder?._id) {
        setOrders((previous) =>
          previous.map((order) =>
            order._id === updatedOrder._id
              ? { ...order, ...updatedOrder }
              : order,
          ),
        );
      } else {
        await fetchOrders(false);
      }

      toast.success("Contact and collection schedule updated.");

      setShowScheduleModal(false);
      setScheduleOrder(null);
    } catch (error) {
      console.error("Failed to update booking details:", error);

      toast.error(
        error.response?.data?.message || "Failed to update the schedule.",
      );
    } finally {
      setScheduleSaving(false);
    }
  };

  // ------------------------------------------------------------
  // DELETE ORDER
  // ------------------------------------------------------------

  const handleDeleteOrder = async (order) => {
    const confirmed = window.confirm(
      `Delete the record for ${
        order.name || "this customer"
      }? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      await axios.delete(`${API}/orders/${order._id}`, authConfig());

      setOrders((previous) =>
        previous.filter((item) => item._id !== order._id),
      );

      toast.success("Record deleted.");
    } catch (error) {
      console.error("Failed to delete order:", error);

      toast.error(error.response?.data?.message || "Failed to delete record.");
    }
  };

  // ------------------------------------------------------------
  // REUSABLE TABLE ELEMENTS
  // ------------------------------------------------------------

  const renderOrderStatus = (order) => (
    <div className="min-w-[135px]">
      <span
        className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
        }`}
      >
        {order.status || "Pending"}
      </span>

      <select
        aria-label={`Update order status for ${order.name}`}
        value={order.status || "Pending"}
        disabled={updatingId === order._id}
        onChange={(event) => handleStatusChange(order._id, event.target.value)}
        className="block w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs outline-none focus:border-emerald-600 disabled:opacity-50"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );

  const renderCustomer = (order) => (
    <div>
      <p className="font-semibold text-slate-800">
        {order.name || "Unnamed customer"}
      </p>

      {order.contact ? (
        <a
          href={`tel:${String(order.contact).replace(/[^\d+]/g, "")}`}
          className="mt-1 inline-block text-emerald-800 hover:underline"
        >
          {order.contact}
        </a>
      ) : (
        <p className="mt-1 text-slate-400">No contact provided</p>
      )}

      {order.customer?.email && (
        <p className="mt-1 text-xs text-slate-500">{order.customer.email}</p>
      )}
    </div>
  );

  const renderProduct = (order) => (
    <div className="max-w-[250px]">
      {order.productType ? (
        <>
          <p className="font-semibold text-slate-800">{order.productType}</p>

          {order.quantity != null && (
            <p className="mt-1 text-slate-600">
              {order.quantity} {order.quantityUnit}
            </p>
          )}
        </>
      ) : (
        <p className="font-medium text-slate-700">General enquiry</p>
      )}

      <p className="mt-1 whitespace-normal break-words text-xs leading-5 text-slate-500">
        {order.message || "No additional details"}
      </p>

      {order.bookingNotes && (
        <p className="mt-2 whitespace-normal break-words text-xs text-slate-500">
          Notes: {order.bookingNotes}
        </p>
      )}
    </div>
  );

  const renderContactStatus = (order) => (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        CONTACT_COLORS[order.contactStatus] || "bg-gray-100 text-gray-700"
      }`}
    >
      {order.contactStatus || "Not Scheduled"}
    </span>
  );

  const renderActions = (order) => (
    <div className="flex min-w-[145px] flex-col gap-2">
      <button
        type="button"
        onClick={() => openScheduleModal(order)}
        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        {order.nextContactAt || order.collectionAt
          ? "Edit follow-up"
          : "Schedule contact"}
      </button>

      <button
        type="button"
        onClick={() => handleDeleteOrder(order)}
        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );

  const viewTitle =
    activeView === "register"
      ? "Chronological Booking Register"
      : activeView === "service"
        ? "First-Come, First-Served Service Queue"
        : "Customer Contact Queue";

  const viewDescription =
    activeView === "register"
      ? "All records, including completed and cancelled bookings."
      : activeView === "service"
        ? "Active bookings in booking-number order. The first customer is next to serve."
        : "Follow-up worklist prioritized by contact urgency, not service order.";

  // ============================================================
  // PAGE UI
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Mebrek Farms · Customer Management
          </p>

          <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">
            Orders & Advance Bookings
          </h1>

          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage the booking register, first-come first-served service queue,
            and customer follow-ups.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openBookingModal}
            className="rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
          >
            + Advance Booking
          </button>

          <button
            type="button"
            onClick={openEnquiryModal}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            + General Enquiry
          </button>

          <button
            type="button"
            onClick={() => {
              fetchOrders(false);
              fetchCustomers();
            }}
            disabled={refreshing}
            className="rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">Advance-booking policy</p>

        <p className="mt-1 text-sm leading-6 text-emerald-900/80">
          Effective 1 November 2026, eggs and manure are handled through advance
          booking. Website enquiries remain accepted and receive a booking
          reference when saved.
        </p>
      </div>

      {/* STATISTICS */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="All Records"
          value={stats.total}
          detail="Website and manual entries"
          accent="emerald"
        />

        <StatCard
          label="Pending"
          value={stats.pending}
          detail="Awaiting resolution"
          accent="amber"
        />

        <StatCard
          label="Scheduled Contacts"
          value={stats.scheduled}
          detail="Active follow-ups"
          accent="blue"
        />

        <StatCard
          label="Overdue Contacts"
          value={stats.overdue}
          detail="Require attention"
          accent="red"
        />

        <StatCard
          label="Completed"
          value={stats.completed}
          detail="Closed orders"
          accent="slate"
        />
      </div>

      {/* NEXT CUSTOMER TO SERVE */}

      <div className="mb-6 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
        {serviceQueue.length > 0 ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Next customer to serve
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-800">
                {serviceQueue[0].name || "Unnamed customer"}
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Booking reference:{" "}
                <span className="font-bold text-emerald-800">
                  {formatBookingNumber(serviceQueue[0])}
                </span>
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Booked: {formatDate(getOrderDate(serviceQueue[0]))}
              </p>

              {serviceQueue[0].productType && (
                <p className="mt-1 text-sm text-slate-600">
                  Request: {serviceQueue[0].productType}
                  {serviceQueue[0].quantity != null
                    ? ` — ${serviceQueue[0].quantity} ${
                        serviceQueue[0].quantityUnit || ""
                      }`
                    : ""}
                </p>
              )}

              {serviceQueue[0].contact && (
                <p className="mt-1 text-sm text-slate-600">
                  Contact: {serviceQueue[0].contact}
                </p>
              )}
            </div>

            <div className="rounded-lg bg-emerald-50 px-6 py-4 text-center">
              <p className="text-xs font-semibold uppercase text-emerald-700">
                Queue position
              </p>

              <p className="mt-1 text-3xl font-bold text-emerald-800">1</p>

              <p className="text-xs text-emerald-700">
                {serviceQueue.length} active{" "}
                {serviceQueue.length === 1 ? "booking" : "bookings"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-slate-800">
              No customers waiting to be served
            </p>

            <p className="mt-1 text-sm text-slate-500">
              New eligible bookings will appear here automatically.
            </p>
          </div>
        )}
      </div>

      {/* VIEW TABS */}

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <ViewButton
            active={activeView === "register"}
            onClick={() => setActiveView("register")}
          >
            Booking Register
          </ViewButton>

          <ViewButton
            active={activeView === "service"}
            onClick={() => setActiveView("service")}
          >
            Service Queue
            <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
              {serviceQueue.length}
            </span>
          </ViewButton>

          <ViewButton
            active={activeView === "queue"}
            onClick={() => setActiveView("queue")}
          >
            Contact Queue
            {stats.overdue > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                {stats.overdue} overdue
              </span>
            )}
          </ViewButton>
        </div>

        <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Records shown
            </p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {displayedOrders.length}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Follow-ups overdue
            </p>
            <p className="mt-1 text-lg font-bold text-red-700">
              {stats.overdue}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Active contacts without a date
            </p>
            <p className="mt-1 text-lg font-bold text-amber-700">
              {stats.unscheduled}
            </p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          {viewDescription}
        </p>
      </div>

      {/* SEARCH */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="order-search"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Search orders and customers
        </label>

        <input
          id="order-search"
          type="search"
          placeholder="Search booking number, name, phone, product, or status..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      {/* LOADING / EMPTY STATE / TABLE */}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-700" />
          <p className="mt-4 text-sm text-slate-500">Loading orders...</p>
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mb-3 text-5xl" aria-hidden="true">
            {activeView === "queue"
              ? "📞"
              : activeView === "service"
                ? "🧾"
                : "📦"}
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            {activeView === "service"
              ? "No customers waiting to be served"
              : activeView === "queue"
                ? "No customers in the contact queue"
                : "No orders found"}
          </h2>

          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
            {activeView === "service"
              ? "New active bookings will appear here automatically."
              : activeView === "queue"
                ? "There are no active follow-ups matching your search. Completed and cancelled orders remain in the register."
                : "Try another search or record an advance booking to get started."}
          </p>

          {activeView === "register" && (
            <button
              type="button"
              onClick={openBookingModal}
              className="mt-5 rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Create Advance Booking
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-800">{viewTitle}</h2>

              <p className="mt-1 text-xs text-slate-500">{viewDescription}</p>
            </div>

            <span className="text-sm text-slate-500">
              {displayedOrders.length} record
              {displayedOrders.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            {activeView === "register" ? (
              /* BOOKING REGISTER */
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-4">Booking number</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Product / request</th>
                    <th className="px-4 py-4">Booking date</th>
                    <th className="px-4 py-4">Expected collection</th>
                    <th className="px-4 py-4">Contact outcome</th>
                    <th className="px-4 py-4">Order status</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order) => (
                    <tr
                      key={order._id}
                      className="align-top transition hover:bg-emerald-50/50"
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {formatBookingNumber(order)}
                        </p>

                        {order.bookingNumber == null && (
                          <p className="mt-1 max-w-[150px] text-xs text-amber-700">
                            Older record — number not assigned
                          </p>
                        )}

                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            order.source === "Manual"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-sky-100 text-sky-800"
                          }`}
                        >
                          {getSourceLabel(order)}
                        </span>
                      </td>

                      <td className="px-4 py-4">{renderCustomer(order)}</td>

                      <td className="px-4 py-4">{renderProduct(order)}</td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDate(getOrderDate(order))}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                        {formatDate(order.collectionAt)}
                      </td>

                      <td className="px-4 py-4">
                        {renderContactStatus(order)}

                        {order.nextContactAt && (
                          <p className="mt-2 text-xs text-slate-500">
                            Next: {formatDate(order.nextContactAt)}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-4">{renderOrderStatus(order)}</td>

                      <td className="px-4 py-4">{renderActions(order)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeView === "service" ? (
              /* FIRST-COME, FIRST-SERVED SERVICE QUEUE */
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-4">Queue position</th>
                    <th className="px-4 py-4">Booking number</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">Product / request</th>
                    <th className="px-4 py-4">Booking date</th>
                    <th className="px-4 py-4">Order status</th>
                    <th className="px-4 py-4">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order) => {
                    const position = serviceQueuePositions.get(order._id);

                    return (
                      <tr
                        key={order._id}
                        className={`align-top transition ${
                          position === 1 ? "bg-emerald-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex min-w-10 items-center justify-center rounded-full px-3 py-2 text-sm font-bold ${
                              position === 1
                                ? "bg-emerald-700 text-white"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {position ?? "—"}
                          </span>

                          {position === 1 && (
                            <p className="mt-2 whitespace-nowrap text-xs font-bold text-emerald-800">
                              NEXT TO SERVE
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-800">
                            {formatBookingNumber(order)}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {getSourceLabel(order)}
                          </p>
                        </td>

                        <td className="px-4 py-4">{renderCustomer(order)}</td>

                        <td className="px-4 py-4">{renderProduct(order)}</td>

                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {formatDate(getOrderDate(order))}
                        </td>

                        <td className="px-4 py-4">
                          {renderOrderStatus(order)}
                        </td>

                        <td className="px-4 py-4">{renderActions(order)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              /* CONTACT QUEUE */
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-4">Priority</th>
                    <th className="px-4 py-4">Booking / customer</th>
                    <th className="px-4 py-4">Next contact</th>
                    <th className="px-4 py-4">Product / quantity</th>
                    <th className="px-4 py-4">Last outcome / notes</th>
                    <th className="px-4 py-4">Collection</th>
                    <th className="px-4 py-4">Next action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order) => {
                    const overdue = isContactOverdue(order);
                    const nextContact = getValidDate(order.nextContactAt);

                    return (
                      <tr
                        key={order._id}
                        className={`align-top transition hover:bg-emerald-50/50 ${
                          overdue ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${getPriorityClass(
                              order,
                            )}`}
                          >
                            {getPriorityLabel(order)}
                          </span>

                          <p className="mt-2 text-xs text-slate-500">
                            {order.status || "Pending"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-800">
                            {formatBookingNumber(order)}
                          </p>

                          <div className="mt-2">{renderCustomer(order)}</div>
                        </td>

                        <td className="px-4 py-4">
                          {nextContact ? (
                            <>
                              <p
                                className={`font-semibold ${
                                  overdue ? "text-red-700" : "text-slate-800"
                                }`}
                              >
                                {nextContact.toLocaleDateString()}
                              </p>

                              <p
                                className={`mt-1 text-xs ${
                                  overdue
                                    ? "font-semibold text-red-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {nextContact.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>

                              {overdue && (
                                <p className="mt-2 text-xs font-bold text-red-700">
                                  Follow-up is overdue
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="font-semibold text-amber-700">
                              Contact date needed
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {order.productType ? (
                            <>
                              <p className="font-semibold text-slate-800">
                                {order.productType}
                              </p>

                              <p className="mt-1 text-slate-600">
                                {order.quantity ?? "Quantity unknown"}{" "}
                                {order.quantityUnit || ""}
                              </p>
                            </>
                          ) : (
                            <p className="font-medium text-slate-700">
                              General enquiry
                            </p>
                          )}

                          {order.message && (
                            <p className="mt-2 max-w-[220px] whitespace-normal break-words text-xs text-slate-500">
                              {order.message}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {renderContactStatus(order)}

                          {order.bookingNotes && (
                            <p className="mt-2 max-w-[220px] whitespace-normal break-words text-xs leading-5 text-slate-500">
                              {order.bookingNotes}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                          {formatDate(order.collectionAt)}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex min-w-[150px] flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => openScheduleModal(order)}
                              className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                            >
                              Record call outcome
                            </button>

                            <button
                              type="button"
                              onClick={() => openScheduleModal(order)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Edit schedule
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION */}

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <strong className="text-slate-700">
                {displayedOrders.length ? (page - 1) * PAGE_SIZE + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-700">
                {Math.min(page * PAGE_SIZE, displayedOrders.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-700">
                {displayedOrders.length}
              </strong>
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="min-w-[70px] rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                {page} / {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((previous) => Math.min(totalPages, previous + 1))
                }
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADVANCE BOOKING MODAL
      ======================================================== */}

      {showBookingModal && (
        <Modal onClose={closeBookingModal}>
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              New customer reservation
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-800">
              Create Advance Booking
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Select an existing customer or enter their details manually.
              Booking numbers are assigned when the record is saved.
            </p>
          </div>

          <form onSubmit={handleCreateBooking} className="space-y-4">
            <FormField label="Existing customer">
              <select
                value={newBooking.customerId}
                onChange={(event) =>
                  handleBookingChange("customerId", event.target.value)
                }
                className="form-input"
              >
                <option value="">Enter customer details manually</option>

                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                    {customer.phone ? ` — ${customer.phone}` : ""}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-xs text-slate-500">
                Only existing customers can be linked to a customer record.
              </p>
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Customer name" required>
                <input
                  required
                  value={newBooking.name}
                  onChange={(event) =>
                    handleBookingChange("name", event.target.value)
                  }
                  placeholder="Customer's full name"
                  className="form-input"
                />
              </FormField>

              <FormField label="Phone or email" required>
                <input
                  required
                  value={newBooking.contact}
                  onChange={(event) =>
                    handleBookingChange("contact", event.target.value)
                  }
                  placeholder="Customer's contact"
                  className="form-input"
                />
              </FormField>

              <FormField label="Product" required>
                <select
                  required
                  value={newBooking.productType}
                  onChange={(event) =>
                    handleBookingChange("productType", event.target.value)
                  }
                  className="form-input"
                >
                  <option value="Eggs">Eggs</option>
                  <option value="Manure">Manure</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>

              <FormField label="Quantity" required>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    value={newBooking.quantity}
                    onChange={(event) =>
                      handleBookingChange("quantity", event.target.value)
                    }
                    placeholder="e.g. 20"
                    className="form-input"
                  />

                  <select
                    value={newBooking.quantityUnit}
                    onChange={(event) =>
                      handleBookingChange("quantityUnit", event.target.value)
                    }
                    className="form-input"
                  >
                    <option value="crates">Crates</option>
                    <option value="pieces">Pieces</option>
                    <option value="bags">Bags</option>
                    <option value="trays">Trays</option>
                    <option value="tonnes">Tonnes</option>
                    <option value="kg">Kilograms</option>
                    <option value="loads">Loads</option>
                    <option value="units">Units</option>
                  </select>
                </div>
              </FormField>

              <FormField label="Next contact date and time">
                <input
                  type="datetime-local"
                  value={newBooking.nextContactAt}
                  onChange={(event) =>
                    handleBookingChange("nextContactAt", event.target.value)
                  }
                  className="form-input"
                />
              </FormField>

              <FormField label="Expected collection date and time">
                <input
                  type="datetime-local"
                  value={newBooking.collectionAt}
                  onChange={(event) =>
                    handleBookingChange("collectionAt", event.target.value)
                  }
                  className="form-input"
                />
              </FormField>
            </div>

            <FormField label="Booking notes">
              <textarea
                rows={3}
                value={newBooking.bookingNotes}
                onChange={(event) =>
                  handleBookingChange("bookingNotes", event.target.value)
                }
                placeholder="Special instructions, delivery or collection details..."
                className="form-input resize-y"
              />
            </FormField>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={closeBookingModal}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? "Saving booking..." : "Save Advance Booking"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          GENERAL ENQUIRY MODAL
      ======================================================== */}

      {showEnquiryModal && (
        <Modal
          onClose={() => {
            if (!submitting) setShowEnquiryModal(false);
          }}
        >
          <h2 className="text-2xl font-bold text-slate-800">
            Add General Enquiry
          </h2>

          <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">
            Record an enquiry received by phone, WhatsApp, or in person. Website
            submissions continue to use the original API payload.
          </p>

          <form onSubmit={handleCreateEnquiry} className="space-y-4">
            <FormField label="Customer name" required>
              <input
                required
                value={newEnquiry.name}
                onChange={(event) =>
                  setNewEnquiry((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="Customer's full name"
                className="form-input"
              />
            </FormField>

            <FormField label="Phone or email" required>
              <input
                required
                value={newEnquiry.contact}
                onChange={(event) =>
                  setNewEnquiry((previous) => ({
                    ...previous,
                    contact: event.target.value,
                  }))
                }
                placeholder="Customer's contact"
                className="form-input"
              />
            </FormField>

            <FormField label="Enquiry details" required>
              <textarea
                required
                rows={4}
                value={newEnquiry.message}
                onChange={(event) =>
                  setNewEnquiry((previous) => ({
                    ...previous,
                    message: event.target.value,
                  }))
                }
                placeholder="What did the customer ask about?"
                className="form-input resize-y"
              />
            </FormField>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowEnquiryModal(false)}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Enquiry"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================
          CONTACT / COLLECTION SCHEDULE MODAL
      ======================================================== */}

      {showScheduleModal && scheduleOrder && (
        <Modal onClose={closeScheduleModal}>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Booking follow-up
          </p>

          <h2 className="mt-1 text-2xl font-bold text-slate-800">
            Update Contact Schedule
          </h2>

          <p className="mb-5 mt-2 text-sm text-slate-500">
            {formatBookingNumber(scheduleOrder)} · Customer:{" "}
            <strong className="text-slate-700">{scheduleOrder.name}</strong>
          </p>

          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <FormField label="Next contact date and time">
              <input
                type="datetime-local"
                value={scheduleForm.nextContactAt}
                onChange={(event) => {
                  const value = event.target.value;

                  setScheduleForm((previous) => ({
                    ...previous,
                    nextContactAt: value,
                    contactStatus: value
                      ? previous.contactStatus === "Not Scheduled"
                        ? "Scheduled"
                        : previous.contactStatus
                      : "Not Scheduled",
                  }));
                }}
                className="form-input"
              />
            </FormField>

            <FormField label="Expected collection date and time">
              <input
                type="datetime-local"
                value={scheduleForm.collectionAt}
                onChange={(event) =>
                  handleScheduleChange("collectionAt", event.target.value)
                }
                className="form-input"
              />
            </FormField>

            <FormField label="Contact outcome">
              <select
                value={scheduleForm.contactStatus}
                onChange={(event) =>
                  handleScheduleChange("contactStatus", event.target.value)
                }
                className="form-input"
              >
                {CONTACT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Follow-up notes">
              <textarea
                rows={3}
                value={scheduleForm.bookingNotes}
                onChange={(event) =>
                  handleScheduleChange("bookingNotes", event.target.value)
                }
                placeholder="Record the call outcome, customer response, or next steps..."
                className="form-input resize-y"
              />
            </FormField>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={scheduleSaving}
                onClick={closeScheduleModal}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={scheduleSaving}
                className="rounded-lg bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {scheduleSaving ? "Saving..." : "Save Follow-up"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <style>{`
        .form-input {
          display: block;
          width: 100%;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          padding: 0.75rem;
          font-size: 0.875rem;
          color: #1e293b;
          background: white;
          outline: none;
          transition: border-color 150ms, box-shadow 150ms;
        }

        .form-input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 2px #d1fae5;
        }

        .form-input::placeholder {
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}

// ============================================================
// REUSABLE COMPONENTS
// ============================================================

function ViewButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${
        active
          ? "bg-emerald-700 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, detail, accent = "emerald" }) {
  const accentClasses = {
    emerald: "border-l-emerald-600 text-emerald-800",
    amber: "border-l-amber-500 text-amber-700",
    blue: "border-l-blue-600 text-blue-800",
    red: "border-l-red-600 text-red-700",
    slate: "border-l-slate-500 text-slate-800",
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm ${
        accentClasses[accent] || accentClasses.emerald
      }`}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>

      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function FormField({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>

      {children}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="my-auto w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        {children}
      </div>
    </div>
  );
}
