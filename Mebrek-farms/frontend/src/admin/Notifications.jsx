import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const getId = (value) => {
  if (!value) return null;
  if (typeof value === "object")
    return value?._id?.toString?.() || value?.id?.toString?.() || null;
  return value.toString();
};
const roleLabel = (role) =>
  role === "superadmin"
    ? "Super Admin"
    : role === "manager"
      ? "Manager"
      : role || "";
const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
const latestReply = (item) =>
  Array.isArray(item?.replies)
    ? [...item.replies].sort(
        (a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0),
      )[0] || null
    : null;
const activityTime = (item) =>
  new Date(
    latestReply(item)?.createdAt || item?.updatedAt || item?.createdAt || 0,
  ).getTime();
const attachmentUrl = (item) => {
  if (!item?.url) return "";
  if (/^https?:\/\//i.test(item.url)) return item.url;
  const api = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return `${api.replace(/\/api\/?$/, "")}${item.url.startsWith("/") ? item.url : `/${item.url}`}`;
};
const fileSize = (n = 0) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
const isParticipant = (item, adminId) => {
  const id = getId(adminId);
  return Boolean(
    id && (getId(item?.senderId) === id || getId(item?.recipientId) === id),
  );
};

export default function Notifications({ user }) {
  let savedUser = {};
  try {
    savedUser = JSON.parse(localStorage.getItem("user") || "{}");
  } catch (e) {
    console.error("Unable to parse stored user", e);
  }
  const effectiveUser = user || savedUser || {};
  const currentUserId = getId(
    effectiveUser?._id ||
      effectiveUser?.id ||
      effectiveUser?.admin?._id ||
      effectiveUser?.admin?.id ||
      effectiveUser?.user?._id ||
      effectiveUser?.user?.id,
  );
  const currentRole = normalizeRole(
    effectiveUser?.role ||
      effectiveUser?.admin?.role ||
      effectiveUser?.user?.role ||
      localStorage.getItem("role"),
  );

  const [notifications, setNotifications] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [replying, setReplying] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [composeRecipientId, setComposeRecipientId] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeFiles, setComposeFiles] = useState([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const composeInput = useRef(null);
  const replyInput = useRef(null);
  const audioRef = useRef(null);

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new Audio(notificationSound);
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .catch((e) => console.warn("Notification sound could not play", e));
    } catch (e) {
      console.warn("Notification sound unavailable", e);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      const list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.notifications)
              ? res.notifications
              : [];
      // Only keep direct conversations in which the logged-in administrator participates.
      setNotifications(
        currentUserId
          ? list.filter((item) => isParticipant(item, currentUserId))
          : [],
      );
    } catch (e) {
      console.error("LOAD NOTIFICATIONS ERROR:", e);
      toast.error(e?.response?.data?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
    audioRef.current.preload = "auto";
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentRole !== "superadmin" && currentRole !== "manager") {
      setLoading(false);
      return;
    }
    loadNotifications();
  }, [currentRole, currentUserId, loadNotifications]);

  const loadRecipients = useCallback(async () => {
    if (currentRole !== "superadmin" && currentRole !== "manager") return;
    try {
      setLoadingRecipients(true);
      const res = await getMessageRecipients();
      let list = Array.isArray(res)
        ? res
        : Array.isArray(res?.data?.data)
          ? res.data.data
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res?.recipients)
              ? res.recipients
              : [];
      list = list.filter((admin) => {
        const id = getId(admin?._id || admin?.id);
        const role = normalizeRole(admin?.role);
        if (!id || id === currentUserId) return false;
        // Managers may message other Managers or Super Admins. Super Admins may message Managers or Super Admins.
        return role === "manager" || role === "superadmin";
      });
      setRecipients(list);
      if (currentRole === "manager" && list.length === 1)
        setComposeRecipientId(getId(list[0]._id || list[0].id));
    } catch (e) {
      console.error("LOAD RECIPIENTS ERROR:", e);
      toast.error(e?.response?.data?.message || "Failed to load recipients");
      setRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  }, [currentRole, currentUserId]);

  useEffect(() => {
    if (showCompose) loadRecipients();
  }, [showCompose, loadRecipients]);

  useEffect(() => {
    if (currentRole !== "superadmin" && currentRole !== "manager") return;
    const onCreated = (item) => {
      // Socket events are broadcast by the server; ignore conversations that do not involve me.
      if (!isParticipant(item, currentUserId)) return;
      loadNotifications();
      const sender = getId(item?.senderId);
      if (sender && sender !== currentUserId) {
        playSound();
        toast.info(`🔔 New message from ${item?.senderName || "Admin"}`);
      }
    };
    const onUpdated = (item) => {
      if (!isParticipant(item, currentUserId)) return;
      loadNotifications();
      const reply = latestReply(item);
      const actor = getId(reply?.senderId || item?.senderId);
      if (actor && actor !== currentUserId) {
        playSound();
        toast.info(
          `🔔 New message from ${reply?.senderName || item?.senderName || "Admin"}`,
        );
      }
    };
    socket.on("notificationCreated", onCreated);
    socket.on("notificationUpdated", onUpdated);
    return () => {
      socket.off("notificationCreated", onCreated);
      socket.off("notificationUpdated", onUpdated);
    };
  }, [currentRole, currentUserId, loadNotifications, playSound]);

  const conversationPartyId = useCallback(
    (item) => {
      const sender = getId(item?.senderId);
      const recipient = getId(item?.recipientId);
      if (sender === currentUserId) return recipient;
      if (recipient === currentUserId) return sender;
      return null;
    },
    [currentUserId],
  );

  const conversationPartyName = useCallback(
    (item) => {
      const sender = getId(item?.senderId);
      const recipient = getId(item?.recipientId);
      if (sender === currentUserId) return item?.recipientName || "Admin";
      if (recipient === currentUserId) return item?.senderName || "Admin";
      return "Admin";
    },
    [currentUserId],
  );

  const conversationPartyRole = useCallback(
    (item) => {
      const sender = getId(item?.senderId);
      const recipient = getId(item?.recipientId);
      if (sender === currentUserId)
        return item?.recipientRole || item?.recipientRoles?.[0] || "";
      if (recipient === currentUserId) return item?.senderRole || "";
      return "";
    },
    [currentUserId],
  );

  const conversations = useMemo(() => {
    const groups = new Map();
    notifications.forEach((item) => {
      const id = conversationPartyId(item);
      if (!id) return;
      if (!groups.has(id))
        groups.set(id, {
          id,
          name: conversationPartyName(item),
          role: conversationPartyRole(item),
          notifications: [],
          latestActivity: 0,
        });
      const group = groups.get(id);
      group.notifications.push(item);
      const activity = activityTime(item);
      if (activity >= group.latestActivity) {
        group.latestActivity = activity;
        group.name = conversationPartyName(item);
        group.role = conversationPartyRole(item);
      }
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        notifications: group.notifications.sort(
          (a, b) => activityTime(a) - activityTime(b),
        ),
      }))
      .sort((a, b) => b.latestActivity - a.latestActivity);
  }, [
    notifications,
    conversationPartyId,
    conversationPartyName,
    conversationPartyRole,
  ]);

  const selectedConversation =
    conversations.find((item) => item.id === selectedConversationId) || null;
  const selectedMessage =
    selectedConversation?.notifications?.[
      selectedConversation.notifications.length - 1
    ] || null;

  const openConversation = async (conversation) => {
    setSelectedConversationId(conversation.id);
    for (const item of conversation.notifications) {
      if (item?.isReadByMe === true) continue;
      const id = getId(item?._id || item?.id);
      if (id) {
        try {
          await markNotificationRead(id);
        } catch (e) {
          console.error("MARK READ ERROR:", e);
        }
      }
    }
    setNotifications((prev) =>
      prev.map((item) =>
        conversationPartyId(item) === conversation.id
          ? { ...item, isReadByMe: true }
          : item,
      ),
    );
  };

  const checkFiles = (files) => {
    const result = [];
    const selected = Array.from(files || []);
    if (selected.length > 5)
      toast.error("You can attach a maximum of 5 files.");
    for (const file of selected.slice(0, 5)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
        toast.error(`${file.name}: only images and audio files are allowed.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 10 MB file limit.`);
        continue;
      }
      result.push(file);
    }
    return result;
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!composeRecipientId) return toast.error("Please select a recipient.");
    if (!composeMessage.trim() && !composeFiles.length)
      return toast.error("Enter a message or attach a file.");
    if (currentRole === "manager") {
      const recipient = recipients.find(
        (r) => getId(r._id || r.id) === composeRecipientId,
      );
      if (
        !recipient ||
        !["manager", "superadmin"].includes(normalizeRole(recipient.role))
      )
        return toast.error(
          "Managers can message other Managers or Super Admins.",
        );
    }
    try {
      setSending(true);
      const res = await sendNotification({
        recipientId: composeRecipientId,
        subject: composeSubject.trim(),
        message: composeMessage.trim(),
        attachments: composeFiles,
      });
      const created = res?.data?.notification || res?.notification || res?.data;
      if (created && (created._id || created.id))
        setNotifications((prev) => [
          created,
          ...prev.filter(
            (n) => getId(n._id || n.id) !== getId(created._id || created.id),
          ),
        ]);
      else await loadNotifications();
      toast.success("Message sent successfully.");
      setShowCompose(false);
      setComposeRecipientId("");
      setComposeSubject("");
      setComposeMessage("");
      setComposeFiles([]);
    } catch (e) {
      console.error("SEND MESSAGE ERROR:", e);
      toast.error(e?.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (event) => {
    event.preventDefault();
    if (!selectedMessage) return toast.error("Select a conversation first.");
    if (!replyMessage.trim() && !replyFiles.length)
      return toast.error("Enter a reply or attach a file.");
    try {
      setReplying(true);
      const id = getId(selectedMessage._id || selectedMessage.id);
      const res = await replyNotification(id, {
        message: replyMessage.trim(),
        attachments: replyFiles,
      });
      const updated = res?.data?.notification || res?.notification || res?.data;
      if (updated && (updated._id || updated.id))
        setNotifications((prev) =>
          prev.map((n) =>
            getId(n._id || n.id) === getId(updated._id || updated.id)
              ? updated
              : n,
          ),
        );
      else await loadNotifications();
      setReplyMessage("");
      setReplyFiles([]);
      toast.success("Reply sent successfully.");
    } catch (e) {
      console.error("REPLY ERROR:", e);
      toast.error(e?.response?.data?.message || "Failed to send reply");
    } finally {
      setReplying(false);
    }
  };

  const renderAttachment = (attachment, index) => {
    if (typeof File !== "undefined" && attachment instanceof File) {
      const url = URL.createObjectURL(attachment);
      return (
        <div
          key={`${attachment.name}-${index}`}
          className="rounded-lg border bg-white p-2"
        >
          {attachment.type.startsWith("image/") ? (
            <img
              src={url}
              alt={attachment.name}
              className="max-h-56 rounded object-contain"
            />
          ) : (
            <audio controls src={url} className="w-full" />
          )}
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500">
            <span className="truncate">{attachment.name}</span>
            <span>{fileSize(attachment.size)}</span>
          </div>
        </div>
      );
    }
    const url = attachmentUrl(attachment);
    const name =
      attachment?.name ||
      attachment?.fileName ||
      attachment?.originalName ||
      "Attachment";
    const type = attachment?.type || attachment?.mimeType || "";
    return (
      <div
        key={getId(attachment?._id) || `${name}-${index}`}
        className="rounded-lg border bg-white p-2"
      >
        {type.startsWith("image/") ? (
          <a href={url} target="_blank" rel="noreferrer">
            <img
              src={url}
              alt={name}
              className="max-h-56 rounded object-contain"
            />
            <span className="text-xs">{name}</span>
          </a>
        ) : type.startsWith("audio/") ? (
          <>
            <div className="mb-1 text-xs">🎤 {name}</div>
            <audio controls src={url} className="w-full" />
          </>
        ) : (
          <a href={url} target="_blank" rel="noreferrer">
            📎 {name}
          </a>
        )}
      </div>
    );
  };

  if (currentRole !== "superadmin" && currentRole !== "manager")
    return (
      <div className="p-6">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-2 text-gray-500">
            You are not authorized to access notifications.
          </p>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-[calc(100vh-80px)] flex-col bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Messages and conversations
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposeRecipientId("");
            setComposeSubject("");
            setComposeMessage("");
            setComposeFiles([]);
            setShowCompose(true);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Message
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full border-b bg-white md:max-w-sm md:overflow-y-auto md:border-b-0 md:border-r">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">
              Loading conversations...
            </p>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <div className="text-4xl">💬</div>
              <p className="mt-3 font-medium">No conversations</p>
              <p className="mt-1 text-sm text-gray-500">
                {currentRole === "superadmin"
                  ? "Start a message to a Manager or Super Admin."
                  : "Your messages will appear here."}
              </p>
            </div>
          ) : (
            conversations.map((conversation) => {
              const latest =
                conversation.notifications[
                  conversation.notifications.length - 1
                ];
              const reply = latestReply(latest);
              const unread = conversation.notifications.some(
                (n) => n.isReadByMe !== true,
              );
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation)}
                  className={`w-full border-b px-4 py-4 text-left hover:bg-gray-50 ${selectedConversationId === conversation.id ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate font-semibold ${unread ? "text-gray-900" : "text-gray-700"}`}
                    >
                      {conversation.name}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {latest?.updatedAt
                        ? new Date(latest.updatedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                      {roleLabel(conversation.role)}
                    </span>
                    {unread && (
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {reply?.message ||
                      latest?.message ||
                      (reply?.attachments?.length || latest?.attachments?.length
                        ? "📎 Attachment"
                        : "No message preview")}
                  </p>
                </button>
              );
            })
          )}
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div>
                <div className="text-5xl">💬</div>
                <h2 className="mt-4 font-semibold text-gray-700">
                  Select a conversation
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Choose a conversation from the list.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b bg-white px-5 py-4">
                <div>
                  <h2 className="font-semibold text-gray-800">
                    {selectedConversation.name}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedConversation.notifications.length} message
                    thread(s)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConversationId(null);
                    setReplyMessage("");
                    setReplyFiles([]);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
                {selectedConversation.notifications.map((item) => {
                  const mine = getId(item.senderId) === currentUserId;
                  const attachments = Array.isArray(item.attachments)
                    ? item.attachments
                    : [];
                  const replies = Array.isArray(item.replies)
                    ? [...item.replies].sort(
                        (a, b) =>
                          new Date(a.createdAt || 0) -
                          new Date(b.createdAt || 0),
                      )
                    : [];
                  return (
                    <div key={getId(item._id || item.id)} className="space-y-3">
                      <div
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 md:max-w-[80%] ${mine ? "bg-blue-600 text-white" : "bg-white text-gray-800 shadow-sm"}`}
                        >
                          {item.subject && (
                            <div className="mb-1 text-xs font-semibold opacity-75">
                              {item.subject}
                            </div>
                          )}
                          {item.message && (
                            <p className="whitespace-pre-wrap text-sm">
                              {item.message}
                            </p>
                          )}
                          {attachments.length > 0 && (
                            <div className="mt-3 grid gap-2">
                              {attachments.map(renderAttachment)}
                            </div>
                          )}
                          <div className="mt-2 text-[10px] opacity-70">
                            {item.senderName || "Admin"} ·{" "}
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString()
                              : ""}
                          </div>
                        </div>
                      </div>
                      {replies.map((reply, i) => {
                        const replyMine =
                          getId(reply.senderId) === currentUserId;
                        const files = Array.isArray(reply.attachments)
                          ? reply.attachments
                          : [];
                        return (
                          <div
                            key={getId(reply._id || reply.id) || i}
                            className={`flex ${replyMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[90%] rounded-2xl px-4 py-3 md:max-w-[80%] ${replyMine ? "bg-blue-600 text-white" : "bg-white text-gray-800 shadow-sm"}`}
                            >
                              {reply.message && (
                                <p className="whitespace-pre-wrap text-sm">
                                  {reply.message}
                                </p>
                              )}
                              {files.length > 0 && (
                                <div className="mt-3 grid gap-2">
                                  {files.map(renderAttachment)}
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
              <form onSubmit={sendReply} className="border-t bg-white p-4">
                {replyFiles.length > 0 && (
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {replyFiles.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="relative">
                        {renderAttachment(file, i)}
                        <button
                          type="button"
                          onClick={() =>
                            setReplyFiles((prev) =>
                              prev.filter((_, j) => i !== j),
                            )
                          }
                          className="mt-1 text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="min-w-0 flex-1">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={2}
                      disabled={replying}
                      placeholder="Write a reply..."
                      className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        ref={replyInput}
                        type="file"
                        multiple
                        accept="image/*,audio/*"
                        className="hidden"
                        onChange={(e) => {
                          setReplyFiles(checkFiles(e.target.files));
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={replying}
                        onClick={() => replyInput.current?.click()}
                        className="rounded-lg border px-3 py-2 text-sm"
                      >
                        📎 Attach
                      </button>
                      <span className="text-xs text-gray-400">
                        Images/voice notes · max 5 files · 10 MB each
                      </span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      replying || (!replyMessage.trim() && !replyFiles.length)
                    }
                    className="self-end rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {replying ? "Sending..." : "Reply"}
                  </button>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  New Message
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {currentRole === "manager"
                    ? "Message another Manager or a Super Admin."
                    : "Message a Manager or another Super Admin."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !sending && setShowCompose(false)}
                disabled={sending}
                className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <form onSubmit={sendMessage} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Recipient
                </label>
                <select
                  required
                  value={composeRecipientId}
                  onChange={(e) => setComposeRecipientId(e.target.value)}
                  disabled={sending || loadingRecipients}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingRecipients
                      ? "Loading recipients..."
                      : "Select Recipient"}
                  </option>
                  {recipients.map((recipient) => (
                    <option
                      key={getId(recipient._id || recipient.id)}
                      value={getId(recipient._id || recipient.id)}
                    >
                      {recipient.name || recipient.email || "Admin"} (
                      {roleLabel(recipient.role)})
                    </option>
                  ))}
                </select>
                {!loadingRecipients && recipients.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">
                    No eligible recipients were found. Check that Manager and
                    Super Admin accounts are active.
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Subject
                </label>
                <input
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  disabled={sending}
                  placeholder="Message subject"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Message
                </label>
                <textarea
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  disabled={sending}
                  rows={5}
                  placeholder="Describe the situation..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
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
                  ref={composeInput}
                  type="file"
                  multiple
                  accept="image/*,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    setComposeFiles(checkFiles(e.target.files));
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => composeInput.current?.click()}
                  disabled={sending}
                  className="w-full rounded-lg border-2 border-dashed border-gray-300 px-4 py-4 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  📎 Attach photo or voice note
                </button>
                {composeFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {composeFiles.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="relative">
                        {renderAttachment(file, i)}
                        <button
                          type="button"
                          onClick={() =>
                            setComposeFiles((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                          className="mt-1 text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !sending && setShowCompose(false)}
                  disabled={sending}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    sending ||
                    loadingRecipients ||
                    !composeRecipientId ||
                    (!composeMessage.trim() && !composeFiles.length)
                  }
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
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
