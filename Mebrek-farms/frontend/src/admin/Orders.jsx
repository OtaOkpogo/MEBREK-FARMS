import { useEffect, useState } from "react";
import axios from "axios";

export default function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/orders", {
        headers: {
          Authorization: token,
        },
      });
      setOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">��� Customer Orders</h2>

      {orders.length === 0 ? (
        <p>No orders yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border shadow rounded-lg overflow-hidden">
            <thead className="bg-green-600 text-white">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Message</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b hover:bg-gray-100">
                  <td className="p-3">{order.name}</td>
                  <td className="p-3">{order.email || "—"}</td>
                  <td className="p-3">{order.message}</td>

                  <td className="p-3">
                    {new Date(order.createdAt).toLocaleString()}
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
