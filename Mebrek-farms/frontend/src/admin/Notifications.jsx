import { useEffect, useState } from "react";
import {
  sendNotification,
  getNotifications,
  markNotificationRead,
  replyNotification,
} from "../services/notificationService";

export default function Notifications() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;

  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyingId, setReplyingId] = useState(null);
  const [replyMessages, setReplyMessages] = useState({});
  const [replyLoading, setReplyLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();

      console.log("Notifications API Response:", data);

      // Always keep notifications as an array
      if (Array.isArray(data)) {
        setNotifications(data);
      } else if (Array.isArray(data?.notifications)) {
        setNotifications(data.notifications);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Load Notifications Error:", err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      return alert("Enter a message.");
    }

    try {
      setLoading(true);

      await sendNotification({
        subject: "General Message",
        message,
      });

      alert("Message sent successfully.");

      setMessage("");
      await loadNotifications();
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

      setNotifications((prev) =>
        prev.map((item) =>
          item._id === id
            ? {
                ...item,
                isRead: true,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplyChange = (id, value) => {
    setReplyMessages((prev) => ({
      ...prev,
      [id]: value,
    }));
  };
  const handleReply = async (id) => {
    const message = replyMessages[id];

    if (!message || !message.trim()) {
      return alert("Enter a reply.");
    }

    try {
      setReplyLoading(true);

      await replyNotification(id, {
        message,
      });

      setReplyMessages((prev) => ({
        ...prev,
        [id]: "",
      }));

      await loadNotifications();

      alert("Reply sent successfully.");
    } catch (err) {
      console.error(err);
      alert("Failed to send reply.");
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <div className="p-6">
      {/* ================= MANAGER / STAFF ================= */}

      {(role === "manager" || role === "staff") && (
        <>
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <h2 className="text-2xl font-bold text-green-700 mb-4">
              Send Message to Super Admin
            </h2>

            <form onSubmit={handleSend}>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-600"
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-4 bg-green-700 text-white px-6 py-3 rounded-lg hover:bg-green-800"
              >
                {loading ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            {notifications
              .filter((item) => item.senderId === user.id)
              .map((item) => (
                <div key={item._id} className="bg-white rounded-xl shadow p-5">
                  <div className="font-bold text-green-700">You</div>

                  <div className="mt-3">{item.message}</div>

                  <small className="text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </small>

                  {item.replies?.length > 0 && (
                    <div className="mt-5 space-y-3">
                      {item.replies.map((reply) => (
                        <div
                          key={reply._id}
                          className="ml-8 bg-green-50 border-l-4 border-green-700 p-3 rounded"
                        >
                          <div className="font-bold">{reply.senderName}</div>

                          <div className="text-sm text-gray-500">
                            {reply.senderRole}
                          </div>

                          <div className="mt-2">{reply.message}</div>

                          <small className="text-gray-400">
                            {new Date(reply.createdAt).toLocaleString()}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}

      {/* ================= SUPER ADMIN ================= */}

      {role === "superadmin" && (
        <>
          <h2 className="text-3xl font-bold mb-6">Notifications</h2>

          {notifications.length === 0 ? (
            <div className="bg-white rounded-xl p-6 shadow text-gray-500">
              No notifications found.
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item._id}
                className={`rounded-xl shadow p-5 mb-4 transition ${
                  item.isRead
                    ? "bg-gray-100"
                    : "bg-yellow-100 border-l-8 border-yellow-500"
                }`}
              >
                <div className="flex justify-between items-start gap-6">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{item.senderName}</h3>

                    <p className="text-sm text-green-700 font-semibold">
                      {item.senderRole}
                    </p>

                    {item.subject && (
                      <p className="font-semibold mt-3">{item.subject}</p>
                    )}

                    <p className="mt-2 text-gray-700">{item.message}</p>

                    <small className="text-gray-500">
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                    {/* Replies */}

                    {item.replies?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {item.replies.map((reply) => (
                          <div
                            key={reply._id}
                            className="bg-green-50 border-l-4 border-green-600 rounded p-3"
                          >
                            <div className="font-semibold">
                              {reply.senderName}
                            </div>

                            <div className="text-sm text-gray-500">
                              {reply.senderRole}
                            </div>

                            <div className="mt-2">{reply.message}</div>

                            <small className="text-gray-400">
                              {new Date(reply.createdAt).toLocaleString()}
                            </small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setReplyingId(replyingId === item._id ? null : item._id)
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Reply
                  </button>
                  {replyingId === item._id && (
                    <div className="mt-4">
                      <textarea
                        rows={3}
                        value={replyMessages[item._id] || ""}
                        onChange={(e) =>
                          handleReplyChange(item._id, e.target.value)
                        }
                        placeholder="Write your reply..."
                        className="w-full border rounded-lg p-3"
                      />

                      <button
                        onClick={() => handleReply(item._id)}
                        className="mt-3 bg-green-700 text-white px-5 py-2 rounded-lg"
                      >
                        Send Reply
                      </button>
                    </div>
                  )}
                  {!item.isRead && (
                    <button
                      onClick={() => handleRead(item._id)}
                      className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800"
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
