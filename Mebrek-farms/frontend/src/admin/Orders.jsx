import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import socket from "../services/socket";

const STATUS_OPTIONS = ["Pending", "Contacted", "Completed"];

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Contacted: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [page, setPage] = useState(1);
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
  // DELETE ORDER
  // ==========================

  const openDeleteModal = (order) => {
    setSelectedOrder(order);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setSelectedOrder(null);
    setShowDeleteModal(false);
  };

  const confirmDelete = async () => {
    if (!selectedOrder) return;

    try {
      const token = localStorage.getItem("token");

      await axios.delete(
        `http://localhost:5000/api/orders/${selectedOrder._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setOrders((prev) =>
        prev.filter((order) => order._id !== selectedOrder._id),
      );

      toast.success("Order deleted successfully");

      closeDeleteModal();
    } catch (err) {
      console.error(err);

      toast.error("Unable to delete order");
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
        <button
          onClick={() => fetchOrders(false)}
          disabled={refreshing}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg shadow"
        >
          {refreshing ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* STATISTICS */}
      <div className="grid md:grid-cols-4 gap-5 mb-8">
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
                <th className="p-3 text-center">Actions</th>
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

                  <td className="p-3 text-center">
                    <button
                      onClick={() => openDeleteModal(order)}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Delete
                    </button>
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

      {/* DELETE CONFIRMATION MODAL */}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-[fadeIn_.25s_ease]">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>

              <h2 className="text-2xl font-bold mb-2">Delete Order?</h2>

              <p className="text-gray-600">
                Are you sure you want to permanently delete the order from
              </p>

              <p className="font-bold text-lg mt-2">{selectedOrder?.name}</p>

              <p className="text-sm text-gray-500 mt-2">
                This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={closeDeleteModal}
                className="px-5 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
