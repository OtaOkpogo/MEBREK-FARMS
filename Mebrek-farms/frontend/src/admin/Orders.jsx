import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import socket from "../services/socket";

const STATUS_OPTIONS = ["Pending", "Contacted", "Completed", "Cancelled"];

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Contacted: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newOrder, setNewOrder] = useState({
    name: "",
    contact: "",
    message: "",
  });
  const PAGE_SIZE = 10;

  // ==========================
  // LOAD ORDERS
  // ==========================
  const fetchOrders = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setOrders(res.data);
      if (!showLoader) {
        toast.success("Orders refreshed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ==========================
  // SEARCH
  // ==========================
  useEffect(() => {
    const keyword = search.toLowerCase();
    const result = orders.filter((order) => {
      return (
        order.name?.toLowerCase().includes(keyword) ||
        order.contact?.toLowerCase().includes(keyword) ||
        order.message?.toLowerCase().includes(keyword) ||
        order.status?.toLowerCase().includes(keyword)
      );
    });
    setFilteredOrders(result);
    setPage(1);
  }, [orders, search]);

  // ==========================
  // STATISTICS
  // ==========================
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "Pending").length,
      contacted: orders.filter((o) => o.status === "Contacted").length,
      completed: orders.filter((o) => o.status === "Completed").length,
      cancelled: orders.filter((o) => o.status === "Cancelled").length,
    };
  }, [orders]);

  // ==========================
  // PAGINATION
  // ==========================
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  // ==========================
  // SOCKET.IO LIVE UPDATES
  // ==========================
  useEffect(() => {
    const handleNewOrder = (order) => {
      setOrders((prev) => [order, ...prev]);
      toast.success(`New order received from ${order.name}`);
    };

    const handleStatusUpdated = (updatedOrder) => {
      setOrders((prev) =>
        prev.map((order) =>
          order._id === updatedOrder._id ? updatedOrder : order,
        ),
      );
      toast.info(
        `${updatedOrder.name}'s order marked as ${updatedOrder.status}`,
      );
    };

    const handleOrderDeleted = ({ id }) => {
      setOrders((prev) => prev.filter((order) => order._id !== id));
      toast.error("Order deleted");
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderStatusUpdated", handleStatusUpdated);
    socket.on("orderDeleted", handleOrderDeleted);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderStatusUpdated", handleStatusUpdated);
      socket.off("orderDeleted", handleOrderDeleted);
    };
  }, []);

  // ==========================
  // UPDATE STATUS
  // ==========================

  const handleStatusChange = async (orderId, newStatus) => {
    const token = localStorage.getItem("token");

    const previousOrders = [...orders];

    setOrders((prev) =>
      prev.map((order) =>
        order._id === orderId
          ? {
              ...order,
              status: newStatus,
            }
          : order,
      ),
    );

    setUpdatingId(orderId);

    try {
      await axios.put(
        `http://localhost:5000/api/orders/${orderId}/status`,
        {
          status: newStatus,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Order status updated");
    } catch (err) {
      console.error(err);

      setOrders(previousOrders);

      toast.error("Failed to update order");
    } finally {
      setUpdatingId(null);
    }
  };

  // ==========================
  // ADD ORDER (manual entry)
  // ==========================

  const openAddModal = () => {
    setNewOrder({ name: "", contact: "", message: "" });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setShowAddModal(false);
  };

  const handleNewOrderChange = (field, value) => {
    setNewOrder((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddOrder = async (e) => {
    e.preventDefault();

    if (
      !newOrder.name.trim() ||
      !newOrder.contact.trim() ||
      !newOrder.message.trim()
    ) {
      toast.error("Name, contact, and message are all required.");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      await axios.post(
        "http://localhost:5000/api/orders",
        {
          name: newOrder.name.trim(),
          contact: newOrder.contact.trim(),
          message: newOrder.message.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success("Order added.");
      setShowAddModal(false);

      // Fallback refresh in case the socket "newOrder" event doesn't fire
      // for admin-created orders.
      fetchOrders(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add order.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-bold">Customer Orders 📦</h2>
          <p className="text-gray-500">Manage customer enquiries and orders</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg shadow"
          >
            + Add Order
          </button>
          <button
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg shadow"
          >
            {refreshing ? "Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* STATISTICS */}
      <div className="grid md:grid-cols-5 gap-5 mb-8">
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Total Orders</p>
          <h2 className="text-4xl font-bold text-green-700">{stats.total}</h2>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Pending</p>
          <h2 className="text-4xl font-bold text-yellow-500">
            {stats.pending}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Contacted</p>
          <h2 className="text-4xl font-bold text-blue-600">
            {stats.contacted}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Completed</p>
          <h2 className="text-4xl font-bold text-green-600">
            {stats.completed}
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow p-5">
          <p className="text-gray-500">Cancelled</p>
          <h2 className="text-4xl font-bold text-red-600">{stats.cancelled}</h2>
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white rounded-xl shadow p-5 mb-6">
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border rounded-lg p-3"
        />
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="bg-white rounded-xl shadow p-20 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-700 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading Orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-16 text-center">
          <div className="text-6xl mb-4">📦</div>

          <h2 className="text-2xl font-bold">No Orders Found</h2>

          <p className="text-gray-500 mt-2">
            There are no customer orders matching your search.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow">
          <table className="w-full min-w-[950px]">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Contact</th>
                <th className="p-3 text-left">Message</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>

            <tbody>
              {paginatedOrders.map((order) => (
                <tr
                  key={order._id}
                  className="border-b hover:bg-green-50 transition"
                >
                  <td className="p-3 font-medium whitespace-nowrap">
                    {order.name}
                  </td>

                  <td className="p-3 whitespace-nowrap">{order.contact}</td>

                  <td className="p-3 max-w-sm">
                    <div className="truncate">{order.message}</div>
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          STATUS_COLORS[order.status]
                        }`}
                      >
                        {order.status}
                      </span>

                      <select
                        value={order.status}
                        disabled={updatingId === order._id}
                        onChange={(e) =>
                          handleStatusChange(order._id, e.target.value)
                        }
                        className="border rounded-lg px-2 py-1 text-sm"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-5 border-t">
            <div className="text-gray-600">
              Showing{" "}
              <strong>
                {filteredOrders.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
              </strong>{" "}
              to{" "}
              <strong>
                {Math.min(page * PAGE_SIZE, filteredOrders.length)}
              </strong>{" "}
              of <strong>{filteredOrders.length}</strong> orders
            </div>

            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-40"
              >
                Previous
              </button>

              <div className="px-4 py-2 rounded-lg bg-green-600 text-white">
                {page} / {totalPages}
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ORDER MODAL */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold mb-1">Add Order</h2>
            <p className="text-gray-500 text-sm mb-6">
              Manually log an order taken by phone, WhatsApp, or in person.
            </p>

            <form onSubmit={handleAddOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={newOrder.name}
                  onChange={(e) => handleNewOrderChange("name", e.target.value)}
                  className="w-full border rounded-lg p-3"
                  placeholder="e.g. Victory Chiedozie Ogidi"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Contact (Phone or Email)
                </label>
                <input
                  type="text"
                  value={newOrder.contact}
                  onChange={(e) =>
                    handleNewOrderChange("contact", e.target.value)
                  }
                  className="w-full border rounded-lg p-3"
                  placeholder="e.g. 08136292177"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Order Details
                </label>
                <textarea
                  value={newOrder.message}
                  onChange={(e) =>
                    handleNewOrderChange("message", e.target.value)
                  }
                  className="w-full border rounded-lg p-3 min-h-[100px]"
                  placeholder="What did the customer ask for?"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Add Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
