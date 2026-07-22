import socket from "../services/socket";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  sendNotification,
  getNotifications,
  markNotificationRead,
  replyNotification,
  getManagers,
} from "../services/notificationService";
import notificationSound from "../assets/notification.mp3";
import ChatBubble from "../components/ChatBubble";

const isOwnSender = (senderId, userId) => {
  if (!senderId || !userId) return false;
  const id = senderId?._id?.toString?.() || senderId?.toString?.();
  return id === userId?.toString();
};

const partyIdOf = (idLike) => idLike?._id || idLike?.toString?.() || idLike;

// The "other party" of a thread is always the manager, whichever side
// actually sent this particular doc/reply.
const getManagerPartyId = (item) =>
  item.senderRole === "manager"
    ? partyIdOf(item.senderId)
    : partyIdOf(item.recipientId);

const getManagerPartyName = (item) =>
  item.senderRole === "manager" ? item.senderName : item.recipientName;

const byCreatedAtAsc = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);

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

  const [managers, setManagers] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [composeManagerId, setComposeManagerId] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeLoading, setComposeLoading] = useState(false);

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

  useEffect(() => {
    if (role !== "superadmin") return;
    getManagers()
      .then((res) => setManagers(Array.isArray(res) ? res : res?.data || []))
      .catch((err) => console.error(err));
  }, [role]);

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
      const partyId = getManagerPartyId(notification);
      const isMyThread =
        partyId?.toString?.() === userIdRef.current?.toString?.();
      const isOwnMessage = isOwnSender(
        notification.senderId,
        userIdRef.current,
      );

      if (roleRef.current !== "superadmin" && isMyThread && !isOwnMessage) {
        playNotificationSound();
        pushToast("Super Admin replied to your message.", "success");
      } else if (roleRef.current === "superadmin" && !isOwnMessage) {
        playNotificationSound();
        pushToast(
          `New message from ${notification.senderName || "a manager"}`,
          "info",
        );
      }
    };

    socket.on("notificationCreated", handleCreated);
    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);
      socket.off("notificationUpdated", handleUpdated);
    };
  }, []);

  const isMyThread = (item) =>
    isOwnSender(item.senderId, user.id) ||
    partyIdOf(item.recipientId)?.toString?.() === user.id?.toString?.();

  const conversations = useMemo(() => {
    if (role !== "superadmin") return [];

    return Object.values(
      notifications.reduce((acc, notification) => {
        const id = getManagerPartyId(notification);
        if (!id) return acc;

        if (!acc[id]) {
          acc[id] = {
            id,
            senderName: getManagerPartyName(notification),
            senderRole: "manager",
            messages: [],
            unread: 0,
            latest: notification.createdAt,
          };
        }

        acc[id].messages.push(notification);
        if (!notification.isReadByMe) acc[id].unread++;
        if (new Date(notification.createdAt) > new Date(acc[id].latest)) {
          acc[id].latest = notification.createdAt;
        }

        return acc;
      }, {}),
    )
      .map((conv) => ({
        ...conv,
        messages: [...conv.messages].sort(byCreatedAtAsc),
      }))
      .sort((a, b) => new Date(b.latest) - new Date(a.latest));
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
      if (updated) setSelectedConversation(updated);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation, notifications]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return pushToast("Enter a message.", "warning");

    try {
      setLoading(true);
      await sendNotification({ subject: "General Message", message });
      await loadNotifications();
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
    setReplyMessages((prev) => ({ ...prev, [conversationId]: value }));
  };

  const handleReply = async (conversationId, targetNotificationId) => {
    const replyText = replyMessages[conversationId];
    if (!replyText || !replyText.trim())
      return pushToast("Enter a reply.", "warning");

    try {
      setReplyLoading(true);
      await replyNotification(targetNotificationId, { message: replyText });
      await loadNotifications();
      setReplyMessages((prev) => ({ ...prev, [conversationId]: "" }));
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

  const handlePickManager = (managerId) => {
    setComposeManagerId(managerId);
    const existing = conversations.find((c) => c.id === managerId);
    if (existing) {
      setSelectedConversation(existing);
      setShowCompose(false);
      setComposeManagerId("");
    }
  };

  const handleStartConversation = async (e) => {
    e.preventDefault();
    if (!composeMessage.trim() || !composeManagerId) {
      return pushToast("Pick a manager and enter a message.", "warning");
    }

    try {
      setComposeLoading(true);
      await sendNotification({
        message: composeMessage,
        recipientId: composeManagerId,
      });
      await loadNotifications();
      setComposeMessage("");
      setComposeManagerId("");
      setShowCompose(false);
      pushToast("Message sent.", "success");
    } catch (err) {
      console.error(err);
      pushToast(
        err?.response?.data?.message || "Failed to send message.",
        "error",
      );
    } finally {
      setComposeLoading(false);
    }
  };

  const toastTone = {
    info: "border-l-blue-500 bg-white",
    success: "border-l-green-600 bg-white",
    warning: "border-l-amber-500 bg-white",
    error: "border-l-red-600 bg-white",
  };

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

      {role === "manager" && (
        <div className="bg-white rounded-xl shadow flex flex-col h-[80vh]">
          <div className="border-b p-5">
            <div className="text-xl font-bold">Super Admin</div>
            <div className="text-gray-500">Conversation</div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {notifications
              .filter(isMyThread)
              .slice()
              .sort(byCreatedAtAsc)
              .map((item) => (
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
          </div>

          <div className="border-t p-5">
            <form onSubmit={handleSend}>
              <textarea
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-green-600"
              />

              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-700 text-white px-6 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {role === "superadmin" && (
        <div className="grid grid-cols-12 gap-6 h-[80vh]">
          <div className="col-span-4 bg-white rounded-xl shadow overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">Inbox</h2>
              <button
                onClick={() => setShowCompose((s) => !s)}
                className="text-sm bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800"
              >
                + New
              </button>
            </div>

            {showCompose && (
              <div className="p-4 border-b bg-gray-50 space-y-3">
                <select
                  value={composeManagerId}
                  onChange={(e) => handlePickManager(e.target.value)}
                  className="w-full border rounded-lg p-2 text-sm"
                >
                  <option value="">Select a manager...</option>
                  {managers.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                {composeManagerId &&
                  !conversations.find((c) => c.id === composeManagerId) && (
                    <form
                      onSubmit={handleStartConversation}
                      className="space-y-2"
                    >
                      <textarea
                        rows={3}
                        value={composeMessage}
                        onChange={(e) => setComposeMessage(e.target.value)}
                        placeholder="Type your first message..."
                        className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-600"
                      />
                      <button
                        type="submit"
                        disabled={composeLoading}
                        className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-50"
                      >
                        {composeLoading ? "Sending..." : "Send"}
                      </button>
                    </form>
                  )}
              </div>
            )}

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
                    ${selectedConversation?.id === conversation.id ? " bg-green-100" : ""}`}
                >
                  <div className="flex justify-between">
                    <div>
                      <div className="font-bold">{conversation.senderName}</div>
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
      )}

      {role === "staff" && (
        <div className="bg-white rounded-xl shadow p-6 text-gray-500 text-center">
          You don't have access to notifications.
        </div>
      )}
    </div>
  );
}
