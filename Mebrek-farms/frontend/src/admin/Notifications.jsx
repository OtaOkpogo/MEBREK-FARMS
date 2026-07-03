import socket from "../services/socket";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  sendNotification,
  getNotifications,
  markNotificationRead,
  replyNotification,
} from "../services/notificationService";
import notificationSound from "../assets/notification.mp3";

export default function Notifications() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = user?.role;
  const bottomRef = useRef(null);
  const markingReadRef = useRef(new Set());

  const [notifications, setNotifications] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyMessages, setReplyMessages] = useState({});
  const [replyLoading, setReplyLoading] = useState(false);

  const playNotificationSound = () => {
    const audio = new Audio(notificationSound);
    audio.play();
  };

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.notifications)
          ? data.notifications
          : [];

      setNotifications(list);
    } catch (err) {
      console.error(err);
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const roleRef = useRef(role);
  const userIdRef = useRef(user.id);
  useEffect(() => {
    roleRef.current = role;
    userIdRef.current = user.id;
  }, [role, user.id]);

  useEffect(() => {
    const handleCreated = () => {
      loadNotifications();

      if (roleRef.current === "superadmin") {
        playNotificationSound();
      }
    };

    const handleUpdated = (notification) => {
      loadNotifications();

      if (
        roleRef.current !== "superadmin" &&
        (notification.senderId?.toString() === userIdRef.current ||
          notification.senderId?._id?.toString() === userIdRef.current)
      ) {
        playNotificationSound();
        alert("Super Admin replied to your message.");
      }
    };

    socket.on("notificationCreated", handleCreated);
    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);
      socket.off("notificationUpdated", handleUpdated);
    };
  }, []);

  // Memoized: only produces a new reference when notifications or role
  // actually change, not on every unrelated render (typing, loading, etc).
  // This is what stops the sync effect below from looping forever.
  const conversations = useMemo(() => {
    if (role !== "superadmin") return [];

    return Object.values(
      notifications.reduce((acc, notification) => {
        const id =
          notification.senderId?._id ||
          notification.senderId?.toString() ||
          notification.senderId;

        if (!acc[id]) {
          acc[id] = {
            id,
            senderName: notification.senderName,
            senderRole: notification.senderRole,
            messages: [],
            unread: 0,
            latest: notification.createdAt,
          };
        }

        acc[id].messages.push(notification);

        if (!notification.isRead) {
          acc[id].unread++;
        }

        if (new Date(notification.createdAt) > new Date(acc[id].latest)) {
          acc[id].latest = notification.createdAt;
        }

        return acc;
      }, {}),
    ).sort((a, b) => new Date(b.latest) - new Date(a.latest));
  }, [notifications, role]);

  useEffect(() => {
    if (role !== "superadmin") return;

    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
      return;
    }

    if (selectedConversation) {
      const updated = conversations.find(
        (c) => c.id === selectedConversation.id,
      );

      if (updated) {
        setSelectedConversation(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, role]);

  useEffect(() => {
    if (!selectedConversation) return;

    selectedConversation.messages.forEach((msg) => {
      if (!msg.isRead && !markingReadRef.current.has(msg._id)) {
        markingReadRef.current.add(msg._id);
        handleRead(msg._id).finally(() => {
          markingReadRef.current.delete(msg._id);
        });
      }
    });
  }, [selectedConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [selectedConversation, notifications]);

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
      await loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplyChange = (conversationId, value) => {
    setReplyMessages((prev) => ({
      ...prev,
      [conversationId]: value,
    }));
  };

  const handleReply = async (conversationId, targetNotificationId) => {
    const replyText = replyMessages[conversationId];

    if (!replyText || !replyText.trim()) {
      return alert("Enter a reply.");
    }

    try {
      setReplyLoading(true);

      await replyNotification(targetNotificationId, { message: replyText });

      await loadNotifications();

      setReplyMessages((prev) => ({
        ...prev,
        [conversationId]: "",
      }));

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
              .filter(
                (item) =>
                  item.senderId?.toString() === user.id ||
                  item.senderId?._id === user.id,
              )
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

      {role === "superadmin" && (
        <>
          <div className="grid grid-cols-12 gap-6 h-[80vh]">
            {/* LEFT PANEL */}

            <div className="col-span-4 bg-white rounded-xl shadow overflow-y-auto">
              <div className="p-5 border-b">
                <h2 className="text-2xl font-bold">Inbox</h2>
              </div>

              {conversations.length === 0 ? (
                <div className="p-6 text-gray-500 text-center">
                  No conversations yet.
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`cursor-pointer p-5 border-b transition
                      ${conversation.unread > 0 ? "bg-yellow-50" : "bg-white"}
                      hover:bg-gray-100
                      ${
                        selectedConversation?.id === conversation.id
                          ? " bg-green-100"
                          : ""
                      }`}
                  >
                    <div className="flex justify-between">
                      <div>
                        <div className="font-bold">
                          {conversation.senderName}
                        </div>

                        <>
                          <div className="text-sm text-gray-500">
                            {conversation.senderRole}
                          </div>

                          <div className="text-sm text-gray-400 truncate mt-1">
                            {
                              conversation.messages[
                                conversation.messages.length - 1
                              ]?.message
                            }
                          </div>
                        </>
                      </div>

                      {conversation.unread > 0 && (
                        <div className="bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">
                          {conversation.unread}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* RIGHT PANEL */}

            <div className="col-span-8 bg-white rounded-xl shadow flex flex-col">
              {!selectedConversation ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
                  Select a conversation
                </div>
              ) : (
                <>
                  <div className="border-b p-5">
                    <div className="text-xl font-bold">
                      {selectedConversation.senderName}
                    </div>

                    <div className="text-gray-500">
                      {selectedConversation.senderRole}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {selectedConversation.messages.map((item) => (
                      <div key={item._id}>
                        <div className="bg-gray-100 rounded-xl p-4">
                          <div className="font-bold">{item.senderName}</div>

                          <div className="mt-2">{item.message}</div>

                          <small className="text-gray-500">
                            {new Date(item.createdAt).toLocaleString()}
                          </small>
                        </div>

                        {item.replies?.map((reply) => (
                          <div
                            key={reply._id}
                            className="ml-10 mt-3 bg-green-100 rounded-xl p-4"
                          >
                            <div className="font-bold">{reply.senderName}</div>

                            <div className="mt-2">{reply.message}</div>

                            <small className="text-gray-500">
                              {new Date(reply.createdAt).toLocaleString()}
                            </small>
                          </div>
                        ))}
                      </div>
                    ))}

                    <div ref={bottomRef} />

                    <div className="border-t pt-5 mt-4">
                      <textarea
                        rows={3}
                        value={replyMessages[selectedConversation.id] || ""}
                        onChange={(e) =>
                          handleReplyChange(
                            selectedConversation.id,
                            e.target.value,
                          )
                        }
                        placeholder="Type your reply..."
                        className="w-full border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-600"
                      />

                      <div className="flex justify-end mt-3">
                        <button
                          disabled={replyLoading}
                          onClick={() =>
                            handleReply(
                              selectedConversation.id,
                              selectedConversation.messages[
                                selectedConversation.messages.length - 1
                              ]._id,
                            )
                          }
                          className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
                        >
                          {replyLoading ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
