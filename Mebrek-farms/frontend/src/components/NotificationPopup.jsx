import { useState, useEffect, useRef } from "react";
import ChatBubble from "./ChatBubble";

const AUTO_ADVANCE_MS = 8000;

const isOwnSender = (senderId, userId) => {
  if (!senderId || !userId) return false;
  const id = senderId?._id?.toString?.() || senderId?.toString?.();
  return id === userId?.toString();
};

export default function NotificationPopup({
  notifications,
  onClose,
  onMarkRead,
  onReply,
}) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const threadBottomRef = useRef(null);

  useEffect(() => {
    if (notifications && index >= notifications.length) {
      setIndex(0);
    }
  }, [notifications, index]);

  const notification = notifications?.[index];

  useEffect(() => {
    setReplyText("");
  }, [notification?._id]);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notification?.replies?.length, index]);

  const nextNotification = () => {
    if (notifications && index < notifications.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const isTyping = replyText.trim().length > 0;

  useEffect(() => {
    if (!notification || paused || isTyping || replyLoading) return;

    setProgress(0);
    startRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100);
      setProgress(pct);

      if (elapsed >= AUTO_ADVANCE_MS) {
        nextNotification();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification, paused, isTyping, replyLoading]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !notification) return;

    try {
      setReplyLoading(true);
      await onReply(notification._id, replyText.trim());
      setReplyText("");
    } catch (err) {
      console.error(err);
    } finally {
      setReplyLoading(false);
    }
  };

  if (!notifications || notifications.length === 0 || !notification)
    return null;

  // Original message + every reply so far, as one bubble thread.
  const thread = [
    {
      senderId: notification.senderId,
      senderName: notification.senderName,
      senderRole: notification.senderRole,
      message: notification.message,
      createdAt: notification.createdAt,
    },
    ...(notification.replies || []),
  ];

  return (
    <div
      className="fixed top-6 right-6 z-[9999] w-[420px]"
      style={{
        animation: "popup-slide-in 260ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bg-white rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[80vh]">
        {/* Progress bar */}
        <div className="h-1 bg-green-100 shrink-0">
          <div
            className="h-1 bg-green-600 transition-[width] duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}

        <div className="bg-green-700 text-white px-5 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔔</span>

            <div>
              <h2 className="font-bold">{notification.senderName}</h2>

              <small>
                {index + 1} of {notifications.length}
                {(paused || isTyping) && " · Paused"}
              </small>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-xl hover:text-red-300"
            aria-label="Close notifications"
          >
            ✖
          </button>
        </div>

        {/* Chat thread */}

        <div className="p-4 overflow-y-auto flex-1 bg-gray-50">
          {thread.map((entry, i) => (
            <ChatBubble
              key={entry._id || i}
              senderName={
                isOwnSender(entry.senderId, user.id) ? "You" : entry.senderName
              }
              senderRole={entry.senderRole}
              message={entry.message}
              createdAt={entry.createdAt}
              isOwn={isOwnSender(entry.senderId, user.id)}
            />
          ))}
          <div ref={threadBottomRef} />
        </div>

        {/* Reply box */}

        <div className="p-4 border-t shrink-0">
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type a quick reply..."
            disabled={replyLoading}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-600 disabled:opacity-50"
          />

          <div className="flex justify-between items-center mt-2">
            <button
              onClick={() => {
                onMarkRead(notification._id);
                nextNotification();
              }}
              className="bg-gray-200 text-gray-700 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-300"
            >
              ✓ Mark Read
            </button>

            <div className="flex gap-2">
              <button
                onClick={nextNotification}
                className="bg-gray-100 text-gray-600 text-sm px-4 py-1.5 rounded-lg hover:bg-gray-200"
              >
                Later
              </button>

              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || replyLoading}
                className="bg-green-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-50"
              >
                {replyLoading ? "Sending..." : "Reply"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popup-slide-in {
          from { opacity: 0; transform: translateX(32px) scale(0.97); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
