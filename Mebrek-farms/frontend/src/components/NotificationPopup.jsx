import { useState } from "react";

export default function NotificationPopup({
  notifications,
  onClose,
  onMarkRead,
}) {
  const [index, setIndex] = useState(0);

  if (!notifications || notifications.length === 0) return null;

  const notification = notifications[index];

  const nextNotification = () => {
    if (index < notifications.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] w-[420px] animate-bounce">
      <div className="bg-white rounded-2xl shadow-2xl border overflow-hidden">

        {/* Header */}

        <div className="bg-green-700 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔔</span>

            <div>
              <h2 className="font-bold">
                New Notification
              </h2>

              <small>
                {index + 1} of {notifications.length}
              </small>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-xl hover:text-red-300"
          >
            ✖
          </button>
        </div>

        {/* Body */}

        <div className="p-6">

          <div className="mb-4">
            <p className="font-bold text-lg">
              {notification.senderName}
            </p>

            <p className="text-sm text-gray-500 uppercase">
              {notification.senderRole}
            </p>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            {notification.message}
          </div>

          <p className="text-xs text-gray-400 mb-6">
            {new Date(notification.createdAt).toLocaleString()}
          </p>

          <div className="flex justify-between">

            <button
              onClick={() => {
                onMarkRead(notification._id);
                nextNotification();
              }}
              className="bg-green-700 text-white px-5 py-2 rounded-lg hover:bg-green-800"
            >
              ✓ Mark Read
            </button>

            <button
              onClick={nextNotification}
              className="bg-gray-300 px-5 py-2 rounded-lg hover:bg-gray-400"
            >
              Later
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
