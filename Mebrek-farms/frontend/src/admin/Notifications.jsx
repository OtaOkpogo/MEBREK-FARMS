import socket from "../services/socket";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  sendNotification,
  getNotifications,
  markNotificationRead,
  replyNotification,
} from "../services/notificationService";
import notificationSound from "../assets/notification.mp3";
import ChatBubble from "../components/ChatBubble";

const isOwnSender = (senderId, userId) => {
  if (!senderId || !userId) return false;
  const id = senderId?._id?.toString?.() || senderId?.toString?.();
  return id === userId?.toString();
};

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
  const [toasts, setToasts] = useState([]);

  const playNotificationSound = () => {
    const audio = new Audio(notificationSound);
    audio.play().catch(() => {});
  };

  const pushToast = (text, tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const loadNotifications = async () => {
    try {
      const res = await getNotifications();

      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.notifications)
            ? res.notifications
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
    const handleCreated = (notification) => {
      loadNotifications();

      const isOwnMessage = isOwnSender(
        notification.senderId,
        userIdRef.current,
      );

      if (roleRef.current === "superadmin" && !isOwnMessage) {
        playNotificationSound();
        pushToast(`New message from ${notification.senderName}`, "info");
      }
    };

    const handleUpdated = (notification) => {
      loadNotifications();

      const isOwnThread = isOwnSender(notification.senderId, userIdRef.current);

      if (roleRef.current !== "superadmin" && isOwnThread) {
        playNotificationSound();
        pushToast("Super Admin replied to your message.", "success");
      }
    };

    socket.on("notificationCreated", handleCreated);
    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);
      socket.off("notificationUpdated", handleUpdated);
    };
  }, []);

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

        if (!notification.isReadByMe) {
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

    const unreadIds = selectedConversation.messages
      .filter((msg) => !msg.isReadByMe)
      .map((msg) => msg._id)
      .filter((id) => !markingReadRef.current.has(id));

    if (unreadIds.length === 0) return;

    unreadIds.forEach((id) => markingReadRef.current.add(id));

    Promise.all(unreadIds.map((id) => markNotificationRead(id)))
      .then(() => loadNotifications())
      .catch((err) => console.error(err))
      .finally(() => {
        unreadIds.forEach((id) => markingReadRef.current.delete(id));
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
      return pushToast("Enter a message.", "warning");
    }

    try {
      setLoading(true);

      await sendNotification({
        subject: "General Message",
        message,
      });

      pushToast("Message sent successfully.", "success");
      setMessage("");
    } catch (err) {
      console.error(err);
      pushToast(
        err?.response?.data?.message || "Failed to send message.",
        "error",
      );
    } finally {
      setLoading(false);
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
      return pushToast("Enter a reply.", "warning");
    }

    try {
      setReplyLoading(true);

      await replyNotification(targetNotificationId, { message: replyText });

      await loadNotifications();

      setReplyMessages((prev) => ({
        ...prev,
        [conversationId]: "",
      }));

      pushToast("Reply sent successfully.", "success");
    } catch (err) {
      console.error(err);
      pushToast(
        err?.response?.data?.message || "Failed to send reply.",
        "error",
      );
    } finally {
      setReplyLoading(false);
    }
  };

  const toastTone = {
    info: "border-l-blue-500 bg-white",
    success: "border-l-green-600 bg-white",
    warning: "border-l-amber-500 bg-white",
    error: "border-l-red-600 bg-white",
  };

  // Builds [originalMessage, ...replies] as a single flat bubble thread
  const buildThread = (item) => [
    {
      _id: item._id,
      senderId: item.senderId,
      senderName: item.senderName,
      senderRole: item.senderRole,
      message: item.message,
      createdAt: item.createdAt,
    },
    ...(item.replies || []),
  ];

  return (
    <div className="p-6 relative">
      {/* ================= IN-PAGE TOASTS ================= */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`shadow-lg rounded-lg border-l-4 p-3 text-sm ${toastTone[toast.tone] || toastTone.info}`}
            style={{ animation: "toast-in 180ms ease-out" }}
          >
            {toast.text}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ================= MANAGER ONLY ================= */}

      {role === "manager" && (
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
              .filter((item) => isOwnSender(item.senderId, user.id))
              .map((item) => (
                <div key={item._id} className="bg-white rounded-xl shadow p-5">
                  {buildThread(item).map((entry, i) => (
                    <ChatBubble
                      key={entry._id || `${item._id}-${i}`}
                      senderName={
                        isOwnSender(entry.senderId, user.id)
                          ? "You"
                          : entry.senderName
                      }
                      senderRole={entry.senderRole}
                      message={entry.message}
                      createdAt={entry.createdAt}
                      isOwn={isOwnSender(entry.senderId, user.id)}
                    />
                  ))}
                </div>
              ))}
          </div>
        </>
      )}

      {/* ================= SUPER ADMIN ================= */}

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

                  <div className="flex-1 overflow-y-auto p-6">
                    {selectedConversation.messages.map((item) => (
                      <div key={item._id} className="mb-2">
                        {buildThread(item).map((entry, i) => (
                          <ChatBubble
                            key={entry._id || `${item._id}-${i}`}
                            senderName={
                              isOwnSender(entry.senderId, user.id)
                                ? "You"
                                : entry.senderName
                            }
                            senderRole={entry.senderRole}
                            message={entry.message}
                            createdAt={entry.createdAt}
                            isOwn={isOwnSender(entry.senderId, user.id)}
                          />
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

      {/* ================= STAFF (NO ACCESS) ================= */}

      {role === "staff" && (
        <div className="bg-white rounded-xl shadow p-6 text-gray-500 text-center">
          You don't have access to notifications.
        </div>
      )}
    </div>
  );
}
