import { useEffect, useState } from "react";
import {
  sendNotification,
  getNotifications,
  markNotificationRead,
} from "../services/notificationService";

export default function Notifications() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user.role;

  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (role === "superadmin") {
      loadNotifications();
    }
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      return alert("Enter a message.");
    }

    try {
      setLoading(true);

      await sendNotification({
        message,
      });

      alert("Message sent successfully.");

      setMessage("");
    } catch (err) {
      console.error(err);
      alert("Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (id) => {
    try {
      await markNotificationRead(id);

      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      {/* ================= MANAGER ================= */}

      {(role === "manager" || role === "staff") && (
        <div className="bg-white rounded-xl shadow p-6 max-w-2xl">
          <h2 className="text-2xl font-bold text-green-700 mb-4">
            Send Message to Super Admin
          </h2>

          <form onSubmit={handleSend}>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full border rounded-lg p-3"
            />

            <button
              disabled={loading}
              className="mt-4 bg-green-700 text-white px-6 py-3 rounded-lg hover:bg-green-800"
            >
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      )}

      {/* ================= SUPER ADMIN ================= */}

      {role === "superadmin" && (
        <>
          <h2 className="text-3xl font-bold mb-6">
            Notifications
          </h2>

          {notifications.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow">
              No notifications.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                className={`rounded-xl shadow p-5 mb-4 ${
                  item.read
                    ? "bg-gray-100"
                    : "bg-yellow-100 border-l-8 border-yellow-500"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-bold text-lg">
                      {item.senderName}
                    </h3>

                    <p className="text-gray-500">
                      {item.senderRole}
                    </p>

                    <p className="mt-3">
                      {item.message}
                    </p>

                    <small className="text-gray-400">
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>

                  {!item.read && (
                    <button
                      onClick={() => handleRead(item._id)}
                      className="bg-green-700 text-white px-4 py-2 rounded"
                    >
                      Mark Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
