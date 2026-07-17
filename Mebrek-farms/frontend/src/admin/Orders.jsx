import { useEffect, useState } from "react";
import axios from "axios";

const STATUS_OPTIONS = ["Pending", "Contacted", "Completed"];

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-700",
  Contacted: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.error("No token found. User may not be logged in.");
        return;
      }

      const res = await axios.get("http://localhost:5000/api/orders", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const refreshOrders = () => {
      fetchOrders();
    };

    window.addEventListener("orderCreated", refreshOrders);

    return () => {
      window.removeEventListener("orderCreated", refreshOrders);
    };
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    const token = localStorage.getItem("token");

    // Optimistic update so the dropdown feels instant; revert on failure.
    const previousOrders = orders;

    setOrders((prev) =>
      prev.map((o) => (o._id === orderId ? { ...o, status: newStatus } : o)),
    );

    setUpdatingId(orderId);

    try {
      await axios.put(
        `http://localhost:5000/api/orders/${orderId}/status`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (err) {
      console.error(err);
      setOrders(previousOrders);
      alert("Failed to update order status. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6"> Customer Orders 📦</h2>

      {orders.length === 0 ? (
        <p>No orders yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border shadow rounded-lg overflow-hidden">
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
              {orders.map((order) => (
                <tr key={order._id} className="border-b hover:bg-gray-100">
                  <td className="p-3">{order.name}</td>
                  <td className="p-3">{order.contact || "—"}</td>
                  <td className="p-3">{order.message}</td>

                  <td className="p-3">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          STATUS_COLORS[order.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {order.status || "Pending"}
                      </span>

                      <select
                        value={order.status || "Pending"}
                        disabled={updatingId === order._id}
                        onChange={(e) =>
                          handleStatusChange(order._id, e.target.value)
                        }
                        className="border rounded-lg p-1 text-sm disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
