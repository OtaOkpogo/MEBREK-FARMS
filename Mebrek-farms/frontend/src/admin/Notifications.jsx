import { useEffect, useMemo, useRef, useState } from "react";

import { toast } from "react-toastify";

import {
  getNotifications,
  sendNotification,
  markNotificationRead,
  replyNotification,
  getMessageRecipients,
} from "../services/notificationService";

import socket from "../services/socket";

import notificationSound from "../assets/notification.mp3";

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    return value?._id?.toString?.() || value?.id?.toString?.() || null;
  }

  return value.toString();
};

// ============================================================
// ROLE LABEL
// ============================================================

const getRoleLabel = (role) => {
  if (role === "superadmin") return "Super Admin";

  if (role === "manager") return "Manager";

  return role || "";
};

// ============================================================
// LATEST REPLY
// ============================================================

const getLatestReply = (notification) => {
  const replies = Array.isArray(notification?.replies)
    ? notification.replies
    : [];

  if (!replies.length) return null;

  return [...replies].sort(
    (a, b) =>
      new Date(b?.createdAt || 0).getTime() -
      new Date(a?.createdAt || 0).getTime(),
  )[0];
};

// ============================================================
// LATEST ACTOR
// ============================================================

const getLatestActorId = (notification) => {
  const latestReply = getLatestReply(notification);

  if (latestReply) {
    return getId(latestReply.senderId);
  }

  return getId(notification?.senderId);
};

// ============================================================
// LATEST ACTIVITY
// ============================================================

const getLatestActivityDate = (notification) => {
  const latestReply = getLatestReply(notification);

  return new Date(
    latestReply?.createdAt ||
      notification?.updatedAt ||
      notification?.createdAt ||
      0,
  ).getTime();
};

// ============================================================
// FILE SIZE
// ============================================================

const formatFileSize = (bytes) => {
  if (!bytes) return "0 KB";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================================
// ATTACHMENT URL
// ============================================================

const getAttachmentUrl = (attachment) => {
  if (!attachment?.url) {
    return "";
  }

  // Already an absolute URL
  if (/^https?:\/\//i.test(attachment.url)) {
    return attachment.url;
  }

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  const backendOrigin = apiBase.replace(/\/api\/?$/, "");

  return `${backendOrigin}${
    attachment.url.startsWith("/") ? attachment.url : `/${attachment.url}`
  }`;
};

// ============================================================
// COMPONENT
// ============================================================

export default function Notifications({ user }) {
  // ----------------------------------------------------------
  // USER
  // ----------------------------------------------------------

  let storedUser = null;

  try {
    storedUser = JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    console.error("FAILED TO PARSE STORED USER:", error);
  }

  const effectiveUser = user || storedUser || {};

  const currentUserId = getId(
    effectiveUser?._id ||
      effectiveUser?.id ||
      effectiveUser?.admin?._id ||
      effectiveUser?.admin?.id ||
      effectiveUser?.user?._id ||
      effectiveUser?.user?.id,
  );

  const currentRole = String(
    effectiveUser?.role ||
      effectiveUser?.admin?.role ||
      effectiveUser?.user?.role ||
      localStorage.getItem("role") ||
      "",
  )
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------

  const [notifications, setNotifications] = useState([]);

  const [selectedConversationId, setSelectedConversationId] = useState(null);

  const [replyMessage, setReplyMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [sending, setSending] = useState(false);

  const [replying, setReplying] = useState(false);

  const [showCompose, setShowCompose] = useState(false);

  const [composeRecipientId, setComposeRecipientId] = useState("");

  const [composeSubject, setComposeSubject] = useState("");

  const [composeMessage, setComposeMessage] = useState("");

  const [composeAttachments, setComposeAttachments] = useState([]);

  const [replyAttachments, setReplyAttachments] = useState([]);

  const [recipients, setRecipients] = useState([]);

  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const audioRef = useRef(null);

  const composeFileInputRef = useRef(null);

  const replyFileInputRef = useRef(null);

  // ==========================================================
  // AUDIO
  // ==========================================================

  useEffect(() => {
    audioRef.current = new Audio(notificationSound);

    audioRef.current.preload = "auto";

    audioRef.current.volume = 1;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = () => {
    if (!audioRef.current) return;

    audioRef.current.currentTime = 0;

    audioRef.current.play().catch((error) => {
      console.warn("Notification sound could not play:", error);
    });
  };

  // ==========================================================
  // LOAD NOTIFICATIONS
  // ==========================================================

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const res = await getNotifications();

      let list = [];

      if (Array.isArray(res?.data?.data)) {
        list = res.data.data;
      } else if (Array.isArray(res?.data)) {
        list = res.data;
      } else if (Array.isArray(res)) {
        list = res;
      }

      setNotifications(list);
    } catch (error) {
      console.error("LOAD NOTIFICATIONS ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to load notifications",
      );

      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    if (currentRole !== "superadmin" && currentRole !== "manager") {
      setLoading(false);
      return;
    }

    loadNotifications();
  }, [currentUserId, currentRole]);

  // ==========================================================
  // LOAD RECIPIENTS
  // ==========================================================

  const loadRecipients = async () => {
    if (currentRole !== "superadmin") {
      return;
    }

    try {
      setLoadingRecipients(true);

      const res = await getMessageRecipients();

      let list = [];

      if (Array.isArray(res?.data?.data)) {
        list = res.data.data;
      } else if (Array.isArray(res?.data)) {
        list = res.data;
      } else if (Array.isArray(res)) {
        list = res;
      }

      list = list.filter(
        (admin) => getId(admin?._id || admin?.id) !== currentUserId,
      );

      setRecipients(list);
    } catch (error) {
      console.error("LOAD RECIPIENTS ERROR:", error);

      toast.error(
        error?.response?.data?.message || "Failed to load recipients",
      );

      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    if (showCompose && currentRole === "superadmin") {
      loadRecipients();
    }
  }, [showCompose, currentRole, currentUserId]);

  // ==========================================================
  // SOCKET FILTER
  // ==========================================================

  const isNotificationForCurrentUser = (notification) => {
    if (!notification) return false;

    const senderId = getId(notification.senderId);

    const recipientId = getId(notification.recipientId);

    return senderId === currentUserId || recipientId === currentUserId;
  };

  // ==========================================================
  // SOCKET EVENTS
  // ==========================================================

  useEffect(() => {
    if (currentRole !== "superadmin" && currentRole !== "manager") {
      return;
    }

    const handleCreated = (notification) => {
      if (!notification) return;

      if (!isNotificationForCurrentUser(notification)) {
        return;
      }

      const actorId = getLatestActorId(notification);

      if (actorId === currentUserId) {
        return;
      }

      setNotifications((previous) => {
        const id = getId(notification._id || notification.id);

        if (!id) return previous;

        const existing = previous.findIndex(
          (item) => getId(item?._id || item?.id) === id,
        );

        if (existing === -1) {
          return [notification, ...previous];
        }

        const updated = [...previous];

        updated[existing] = notification;

        return updated.sort(
          (a, b) => getLatestActivityDate(b) - getLatestActivityDate(a),
        );
      });

      playNotificationSound();

      toast.info(`🔔 New message from ${notification?.senderName || "Admin"}`);
    };

    const handleUpdated = (notification) => {
      if (!notification) return;

      if (!isNotificationForCurrentUser(notification)) {
        return;
      }

      const actorId = getLatestActorId(notification);

      setNotifications((previous) => {
        const id = getId(notification._id || notification.id);

        if (!id) return previous;

        const existing = previous.findIndex(
          (item) => getId(item?._id || item?.id) === id,
        );

        if (existing === -1) {
          return [notification, ...previous];
        }

        const updated = [...previous];

        updated[existing] = notification;

        return updated.sort(
          (a, b) => getLatestActivityDate(b) - getLatestActivityDate(a),
        );
      });

      if (actorId === currentUserId) {
        return;
      }

      playNotificationSound();

      const latestReply = getLatestReply(notification);

      toast.info(
        `🔔 New message from ${
          latestReply?.senderName || notification?.senderName || "Admin"
        }`,
      );
    };

    socket.on("notificationCreated", handleCreated);

    socket.on("notificationUpdated", handleUpdated);

    return () => {
      socket.off("notificationCreated", handleCreated);

      socket.off("notificationUpdated", handleUpdated);
    };
  }, [currentRole, currentUserId]);

  // ==========================================================
  // FILE VALIDATION
  // ==========================================================

  const validateAttachments = (files) => {
    const maxSize = 10 * 1024 * 1024;

    const selected = Array.from(files || []);

    if (selected.length > 5) {
      toast.error("You can attach a maximum of 5 files.");

      return [];
    }

    const valid = [];

    for (const file of selected) {
      const isImage = file.type.startsWith("image/");

      const isAudio = file.type.startsWith("audio/");

      if (!isImage && !isAudio) {
        toast.error(
          `${file.name} is not a supported attachment type. Only images and audio files are allowed.`,
        );

        continue;
      }

      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds the 10 MB file limit.`);

        continue;
      }

      valid.push(file);
    }

    return valid;
  };

  // ==========================================================
  // ADD COMPOSE ATTACHMENTS
  // ==========================================================

  const addComposeAttachments = (event) => {
    const files = validateAttachments(event.target.files);

    setComposeAttachments(files);

    event.target.value = "";
  };

  // ==========================================================
  // ADD REPLY ATTACHMENTS
  // ==========================================================

  const addReplyAttachments = (event) => {
    const files = validateAttachments(event.target.files);

    setReplyAttachments(files);

    event.target.value = "";
  };

  // ==========================================================
  // REMOVE COMPOSE ATTACHMENT
  // ==========================================================

  const removeComposeAttachment = (index) => {
    setComposeAttachments((previous) => previous.filter((_, i) => i !== index));
  };

  // ==========================================================
  // REMOVE REPLY ATTACHMENT
  // ==========================================================

  const removeReplyAttachment = (index) => {
    setReplyAttachments((previous) => previous.filter((_, i) => i !== index));
  };

  // ==========================================================
  // ATTACHMENT PREVIEW
  // ==========================================================

  const renderAttachmentPreview = (
    attachment,
    removable = false,
    removeHandler = null,
    index = null,
  ) => {
    // --------------------------------------------------------
    // LOCAL FILE
    // --------------------------------------------------------

    if (attachment instanceof File) {
      const url = URL.createObjectURL(attachment);

      const isImage = attachment.type.startsWith("image/");

      const isAudio = attachment.type.startsWith("audio/");

      if (isImage) {
        return (
          <div className="relative overflow-hidden rounded-lg border bg-gray-50">
            <img
              src={url}
              alt={attachment.name}
              className="h-32 w-full object-cover"
            />

            {removable && removeHandler && (
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(url);

                  removeHandler(index);
                }}
                className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white"
              >
                ✕
              </button>
            )}

            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <div className="truncate text-xs text-gray-600">
                {attachment.name}
              </div>

              <span className="shrink-0 text-[10px] text-gray-400">
                {formatFileSize(attachment.size)}
              </span>
            </div>
          </div>
        );
      }

      if (isAudio) {
        return (
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <span>🎤</span>

              <span className="truncate">{attachment.name}</span>
            </div>

            <audio controls src={url} className="w-full" />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {formatFileSize(attachment.size)}
              </span>

              {removable && removeHandler && (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(url);

                    removeHandler(index);
                  }}
                  className="text-xs font-medium text-red-600"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
          <span className="truncate text-sm">📎 {attachment.name}</span>

          {removable && removeHandler && (
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(url);

                removeHandler(index);
              }}
              className="ml-2 text-xs text-red-600"
            >
              Remove
            </button>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // STORED ATTACHMENT
    // --------------------------------------------------------

    const attachmentUrl = getAttachmentUrl(attachment);

    const attachmentName =
      attachment?.name ||
      attachment?.fileName ||
      attachment?.originalName ||
      "Attachment";

    const attachmentType = attachment?.type || attachment?.mimeType || "";

    const isImage = attachmentType.startsWith("image/");

    const isAudio = attachmentType.startsWith("audio/");

    // --------------------------------------------------------
    // STORED IMAGE
    // --------------------------------------------------------

    if (isImage) {
      return (
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={attachmentUrl}
            alt={attachmentName}
            className="max-h-72 rounded-lg object-contain"
          />

          <div className="mt-1 text-xs opacity-75">{attachmentName}</div>
        </a>
      );
    }

    // --------------------------------------------------------
    // STORED AUDIO
    // --------------------------------------------------------

    if (isAudio) {
      return (
        <div>
          <div className="mb-2 text-xs font-medium">🎤 {attachmentName}</div>

          <audio controls src={attachmentUrl} className="w-full max-w-sm" />

          {attachment.size && (
            <div className="mt-1 text-[10px] opacity-60">
              {formatFileSize(attachment.size)}
            </div>
          )}
        </div>
      );
    }

    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    return (
      <a
        href={attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg border p-3 text-sm hover:bg-gray-50"
      >
        📎
        <span className="truncate">{attachmentName}</span>
      </a>
    );
  };

  // ==========================================================
  // CONVERSATION GROUPING
  // ==========================================================

  const getConversationPartyId = (item) => {
    if (!item) return null;

    if (item.managerId) {
      return getId(item.managerId);
    }

    const senderId = getId(item.senderId);

    const recipientId = getId(item.recipientId);

    if (item.senderRole === "manager") {
      return senderId;
    }

    if (item.recipientRole === "manager") {
      return recipientId;
    }

    if (currentRole === "superadmin") {
      if (senderId === currentUserId) {
        return recipientId;
      }

      return senderId;
    }

    if (senderId === currentUserId) {
      return recipientId;
    }

    return senderId;
  };

  // ==========================================================
  // CONVERSATION PARTY NAME
  // ==========================================================

  const getConversationPartyName = (item) => {
    if (!item) return "Conversation";

    if (item.managerId && item.managerName) {
      return item.managerName;
    }

    const senderId = getId(item.senderId);

    const recipientId = getId(item.recipientId);

    if (item.senderRole === "manager") {
      return item.senderName || "Manager";
    }

    if (recipientId === currentUserId) {
      return item.senderName || "Admin";
    }

    if (senderId === currentUserId) {
      return item.recipientName || "Admin";
    }

    return item.senderName || item.recipientName || "Admin";
  };

  // ==========================================================
  // CONVERSATION PARTY ROLE
  // ==========================================================

  const getConversationPartyRole = (item) => {
    if (!item) return "";

    const senderId = getId(item.senderId);

    const recipientId = getId(item.recipientId);

    if (senderId === currentUserId) {
      return item.recipientRole || "";
    }

    if (recipientId === currentUserId) {
      return item.senderRole || "";
    }

    if (item.senderRole === "manager") {
      return "manager";
    }

    return item.recipientRole || item.senderRole || "";
  };

  // ==========================================================
  // CONVERSATIONS
  // ==========================================================

  const conversations = useMemo(() => {
    const grouped = new Map();

    for (const item of notifications) {
      const partyId = getConversationPartyId(item);

      if (!partyId) continue;

      const existing = grouped.get(partyId);

      if (!existing) {
        grouped.set(partyId, {
          id: partyId,

          name: getConversationPartyName(item),

          role: getConversationPartyRole(item),

          notifications: [item],

          latestActivity: getLatestActivityDate(item),
        });

        continue;
      }

      existing.notifications.push(item);

      const activity = getLatestActivityDate(item);

      if (activity > existing.latestActivity) {
        existing.latestActivity = activity;

        existing.name = getConversationPartyName(item);

        existing.role = getConversationPartyRole(item);
      }
    }

    const result = Array.from(grouped.values());

    result.forEach((conversation) => {
      conversation.notifications.sort(
        (a, b) => getLatestActivityDate(a) - getLatestActivityDate(b),
      );
    });

    result.sort((a, b) => b.latestActivity - a.latestActivity);

    return result;
  }, [notifications, currentRole, currentUserId]);

  // ==========================================================
  // SELECTED CONVERSATION
  // ==========================================================

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) {
      return null;
    }

    return (
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) || null
    );
  }, [conversations, selectedConversationId]);

  const selectedConversationData =
    selectedConversation?.notifications?.[
      selectedConversation.notifications.length - 1
    ] || null;

  // ==========================================================
  // OPEN CONVERSATION
  // ==========================================================

  const openConversation = async (conversation) => {
    if (!conversation) return;

    setSelectedConversationId(conversation.id);

    const unreadMessages = conversation.notifications.filter(
      (item) => item?.isReadByMe !== true,
    );

    for (const item of unreadMessages) {
      const id = getId(item?._id || item?.id);

      if (!id) continue;

      try {
        await markNotificationRead(id);
      } catch (error) {
        console.error("MARK READ ERROR:", error);
      }
    }

    setNotifications((previous) =>
      previous.map((item) => {
        if (getConversationPartyId(item) !== conversation.id) {
          return item;
        }

        return {
          ...item,
          isReadByMe: true,
        };
      }),
    );
  };

  // ==========================================================
  // CLOSE CONVERSATION
  // ==========================================================

  const closeConversation = () => {
    setSelectedConversationId(null);

    setReplyMessage("");

    setReplyAttachments([]);
  };

  // ==========================================================
  // OPEN COMPOSE
  // ==========================================================

  const openCompose = () => {
    setComposeRecipientId("");

    setComposeSubject("");

    setComposeMessage("");

    setComposeAttachments([]);

    setShowCompose(true);
  };

  // ==========================================================
  // CLOSE COMPOSE
  // ==========================================================

  const closeCompose = () => {
    if (sending) return;

    setShowCompose(false);

    setComposeRecipientId("");

    setComposeSubject("");

    setComposeMessage("");

    setComposeAttachments([]);
  };

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const handleSendMessage = async (event) => {
    event?.preventDefault?.();

    const trimmed = composeMessage.trim();

    if (!trimmed && composeAttachments.length === 0) {
      toast.error("Please enter a message or attach a file.");

      return;
    }

    if (!composeRecipientId) {
      toast.error("Please select a recipient.");

      return;
    }

    try {
      setSending(true);

      const res = await sendNotification({
        recipientId: composeRecipientId,

        subject: composeSubject.trim(),

        message: trimmed,

        attachments: composeAttachments,
      });

      const created =
        res?.data?.notification || res?.notification || res?.data || null;

      if (created) {
        setNotifications((previous) => {
          const id = getId(created?._id || created?.id);

          const without = id
            ? previous.filter((item) => getId(item?._id || item?.id) !== id)
            : previous;

          return [created, ...without].sort(
            (a, b) => getLatestActivityDate(b) - getLatestActivityDate(a),
          );
        });
      } else {
        await loadNotifications();
      }

      toast.success("Message sent successfully.");

      closeCompose();
    } catch (error) {
      console.error("SEND MESSAGE ERROR:", error);

      toast.error(error?.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // ==========================================================
  // REPLY
  // ==========================================================

  const handleReply = async (event) => {
    event?.preventDefault?.();

    const trimmed = replyMessage.trim();

    if (!trimmed && replyAttachments.length === 0) {
      toast.error("Please enter a reply or attach a file.");

      return;
    }

    if (!selectedConversationData) {
      toast.error("Please select a conversation.");

      return;
    }

    const notificationId = getId(
      selectedConversationData?._id || selectedConversationData?.id,
    );

    if (!notificationId) {
      toast.error("Unable to identify this conversation.");

      return;
    }

    try {
      setReplying(true);

      const res = await replyNotification(notificationId, {
        message: trimmed,

        attachments: replyAttachments,
      });

      const updated =
        res?.data?.notification || res?.notification || res?.data || null;

      if (updated) {
        setNotifications((previous) => {
          const id = getId(updated?._id || updated?.id);

          if (!id) {
            return previous;
          }

          const exists = previous.some(
            (item) => getId(item?._id || item?.id) === id,
          );

          if (!exists) {
            return [updated, ...previous];
          }

          return previous
            .map((item) =>
              getId(item?._id || item?.id) === id ? updated : item,
            )
            .sort(
              (a, b) => getLatestActivityDate(b) - getLatestActivityDate(a),
            );
        });
      } else {
        await loadNotifications();
      }

      setReplyMessage("");

      setReplyAttachments([]);

      toast.success("Reply sent successfully.");
    } catch (error) {
      console.error("REPLY ERROR:", error);

      toast.error(error?.response?.data?.message || "Failed to send reply");
    } finally {
      setReplying(false);
    }
  };

  // ==========================================================
  // UNREAD
  // ==========================================================

  const isConversationUnread = (conversation) =>
    conversation.notifications.some((item) => item?.isReadByMe !== true);

  // ==========================================================
  // ACCESS CONTROL
  // ==========================================================

  if (currentRole !== "superadmin" && currentRole !== "manager") {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>

          <p className="mt-2 text-gray-500">
            You are not authorized to access notifications.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="flex h-full min-h-[calc(100vh-80px)] flex-col bg-gray-50">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>

            <p className="mt-1 text-sm text-gray-500">
              Messages and conversations
            </p>
          </div>

          {currentRole === "superadmin" && (
            <button
              type="button"
              onClick={openCompose}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + New Message
            </button>
          )}
        </div>
      </div>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <div className="flex min-h-0 flex-1">
        {/* ====================================================
            CONVERSATIONS
        ==================================================== */}

        <div className="w-full max-w-sm overflow-y-auto border-r bg-white">
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-4xl">💬</div>

              <p className="mt-3 font-medium text-gray-700">No conversations</p>

              <p className="mt-1 text-sm text-gray-500">
                {currentRole === "superadmin"
                  ? "Start a new message to a Manager or Super Admin."
                  : "Your messages will appear here."}
              </p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const active = selectedConversationId === conversation.id;

              const unread = isConversationUnread(conversation);

              const latest =
                conversation.notifications[
                  conversation.notifications.length - 1
                ];

              const latestReply = getLatestReply(latest);

              const preview = latestReply?.message || latest?.message || "";

              return (
                <button
                  type="button"
                  key={conversation.id}
                  onClick={() => openConversation(conversation)}
                  className={`w-full border-b px-4 py-4 text-left ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`truncate font-semibold ${
                            unread ? "text-gray-900" : "text-gray-700"
                          }`}
                        >
                          {conversation.name}
                        </span>

                        {conversation.role && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                            {getRoleLabel(conversation.role)}
                          </span>
                        )}

                        {unread && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                        )}
                      </div>

                      <p
                        className={`mt-1 truncate text-sm ${
                          unread ? "font-medium text-gray-700" : "text-gray-500"
                        }`}
                      >
                        {preview ||
                          (latestReply?.attachments?.length ||
                          latest?.attachments?.length
                            ? "📎 Attachment"
                            : "No message preview")}
                      </p>
                    </div>

                    <span className="shrink-0 text-[11px] text-gray-400">
                      {latest?.updatedAt
                        ? new Date(latest.updatedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ====================================================
            CONVERSATION
        ==================================================== */}

        <div className="min-w-0 flex-1">
          {!selectedConversation ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <div className="text-5xl">💬</div>

                <h2 className="mt-4 text-lg font-semibold text-gray-700">
                  Select a conversation
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Choose a conversation from the left.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* ==================================================
                  CONVERSATION HEADER
              ================================================== */}

              <div className="flex items-center justify-between border-b bg-white px-6 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-800">
                      {selectedConversation.name}
                    </h2>

                    {selectedConversation.role && (
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                        {getRoleLabel(selectedConversation.role)}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    {selectedConversation.notifications.length} message
                    {selectedConversation.notifications.length === 1 ? "" : "s"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeConversation}
                  className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>

              {/* ==================================================
                  MESSAGES
              ================================================== */}

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
                {selectedConversation.notifications.map((notification) => {
                  const rootSenderId = getId(notification?.senderId);

                  const rootIsMine = rootSenderId === currentUserId;

                  const replies = Array.isArray(notification?.replies)
                    ? notification.replies
                    : [];

                  const rootAttachments = Array.isArray(
                    notification?.attachments,
                  )
                    ? notification.attachments
                    : [];

                  return (
                    <div
                      key={getId(notification?._id || notification?.id)}
                      className="space-y-3"
                    >
                      {/* ROOT MESSAGE */}

                      <div
                        className={`flex ${
                          rootIsMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            rootIsMine
                              ? "bg-blue-600 text-white"
                              : "bg-white text-gray-800 shadow-sm"
                          }`}
                        >
                          {notification?.subject && (
                            <div className="mb-1 text-xs font-semibold opacity-75">
                              {notification.subject}
                            </div>
                          )}

                          {notification?.message && (
                            <p className="whitespace-pre-wrap text-sm">
                              {notification.message}
                            </p>
                          )}

                          {rootAttachments.length > 0 && (
                            <div className="mt-3 space-y-3">
                              {rootAttachments.map((attachment, index) => (
                                <div
                                  key={
                                    getId(attachment?._id) ||
                                    `${attachment?.fileName || attachment?.name}-${index}`
                                  }
                                >
                                  {renderAttachmentPreview(attachment)}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 text-[10px] opacity-70">
                            {notification.senderName || "Admin"} ·{" "}
                            {notification.createdAt
                              ? new Date(
                                  notification.createdAt,
                                ).toLocaleString()
                              : ""}
                          </div>
                        </div>
                      </div>

                      {/* REPLIES */}

                      {replies
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(a?.createdAt || 0).getTime() -
                            new Date(b?.createdAt || 0).getTime(),
                        )
                        .map((reply, replyIndex) => {
                          const replySenderId = getId(reply?.senderId);

                          const replyIsMine = replySenderId === currentUserId;

                          const attachments = Array.isArray(reply?.attachments)
                            ? reply.attachments
                            : [];

                          return (
                            <div
                              key={
                                getId(reply?._id || reply?.id) ||
                                `reply-${replyIndex}`
                              }
                              className={`flex ${
                                replyIsMine ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                  replyIsMine
                                    ? "bg-blue-600 text-white"
                                    : "bg-white text-gray-800 shadow-sm"
                                }`}
                              >
                                {reply.message && (
                                  <p className="whitespace-pre-wrap text-sm">
                                    {reply.message}
                                  </p>
                                )}

                                {attachments.length > 0 && (
                                  <div className="mt-3 space-y-3">
                                    {attachments.map(
                                      (attachment, attachmentIndex) => (
                                        <div
                                          key={
                                            getId(attachment?._id) ||
                                            `${attachment?.fileName || attachment?.name}-${attachmentIndex}`
                                          }
                                        >
                                          {renderAttachmentPreview(attachment)}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}

                                <div className="mt-2 text-[10px] opacity-70">
                                  {reply.senderName || "Admin"} ·{" "}
                                  {reply.createdAt
                                    ? new Date(reply.createdAt).toLocaleString()
                                    : ""}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>

              {/* ==================================================
                  REPLY BOX
              ================================================== */}

              <form onSubmit={handleReply} className="border-t bg-white p-4">
                {replyAttachments.length > 0 && (
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {replyAttachments.map((file, index) => (
                      <div key={`${file.name}-${index}`}>
                        {renderAttachmentPreview(
                          file,
                          true,
                          removeReplyAttachment,
                          index,
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Write a reply or attach a voice note/photo..."
                      rows={2}
                      disabled={replying}
                      className="min-h-[50px] w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        ref={replyFileInputRef}
                        type="file"
                        multiple
                        accept="image/*,audio/*"
                        onChange={addReplyAttachments}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => replyFileInputRef.current?.click()}
                        disabled={replying}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        📎 Attach
                      </button>

                      <span className="text-xs text-gray-400">
                        Images and voice notes · max 5 files · 10 MB each
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      replying ||
                      (!replyMessage.trim() && replyAttachments.length === 0)
                    }
                    className="self-end rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {replying ? "Sending..." : "Reply"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          NEW MESSAGE MODAL
      ====================================================== */}

      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            {/* HEADER */}

            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  New Message
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Message a Manager or another Super Admin.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCompose}
                disabled={sending}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={handleSendMessage} className="space-y-4 p-6">
              {/* RECIPIENT */}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Recipient
                </label>

                <select
                  value={composeRecipientId}
                  onChange={(event) =>
                    setComposeRecipientId(event.target.value)
                  }
                  disabled={sending || loadingRecipients}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">
                    {loadingRecipients
                      ? "Loading recipients..."
                      : "Select Recipient"}
                  </option>

                  {!loadingRecipients &&
                    recipients.map((recipient) => (
                      <option
                        key={getId(recipient?._id || recipient?.id)}
                        value={getId(recipient?._id || recipient?.id)}
                      >
                        {recipient.name} ({getRoleLabel(recipient.role)})
                      </option>
                    ))}
                </select>
              </div>

              {/* SUBJECT */}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subject
                </label>

                <input
                  type="text"
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Message subject"
                  disabled={sending}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* MESSAGE */}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Message
                </label>

                <textarea
                  value={composeMessage}
                  onChange={(event) => setComposeMessage(event.target.value)}
                  placeholder="Describe the situation..."
                  rows={5}
                  disabled={sending}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* ATTACHMENTS */}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Attachments
                  </label>

                  <span className="text-xs text-gray-400">
                    Max 5 files · 10 MB each
                  </span>
                </div>

                <input
                  ref={composeFileInputRef}
                  type="file"
                  multiple
                  accept="image/*,audio/*"
                  onChange={addComposeAttachments}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => composeFileInputRef.current?.click()}
                  disabled={sending}
                  className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-5 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  <span className="text-xl">📎</span>

                  <span className="ml-2">Attach photo or voice note</span>
                </button>

                {composeAttachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {composeAttachments.map((file, index) => (
                      <div key={`${file.name}-${index}`}>
                        {renderAttachmentPreview(
                          file,
                          true,
                          removeComposeAttachment,
                          index,
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCompose}
                  disabled={sending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    sending ||
                    loadingRecipients ||
                    !composeRecipientId ||
                    (!composeMessage.trim() && composeAttachments.length === 0)
                  }
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
