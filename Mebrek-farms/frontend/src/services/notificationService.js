import apiClient from "./apiClient";

// ============================================================
// GET NOTIFICATIONS
// ============================================================

export const getNotifications = async () => {
  return await apiClient.get("/notifications");
};

// ============================================================
// SEND NEW NOTIFICATION
// ============================================================

export const sendNotification = async ({
  recipientId,
  subject = "",
  message = "",
  attachments = [],
}) => {
  const formData = new FormData();

  formData.append("recipientId", recipientId);
  formData.append("subject", subject || "");
  formData.append("message", message || "");

  attachments.forEach((file) => {
    formData.append("attachments", file);
  });

  return await apiClient.post("/notifications", formData);
};

// ============================================================
// MARK NOTIFICATION AS READ
// ============================================================

export const markNotificationRead = async (id) => {
  return await apiClient.put(`/notifications/${id}/read`);
};

// ============================================================
// REPLY TO NOTIFICATION
// ============================================================

export const replyNotification = async (
  id,
  { message = "", attachments = [] },
) => {
  const formData = new FormData();

  formData.append("message", message || "");

  attachments.forEach((file) => {
    formData.append("attachments", file);
  });

  return await apiClient.post(`/notifications/${id}/reply`, formData);
};

// ============================================================
// GET MANAGERS
// ============================================================

export const getManagers = async () => {
  return await apiClient.get("/notifications/managers");
};

// ============================================================
// GET UNREAD COUNT
// ============================================================

export const getUnreadCount = async () => {
  return await apiClient.get("/notifications/unread-count");
};

// ============================================================
// GET MESSAGE RECIPIENTS
// ============================================================

export const getMessageRecipients = async () => {
  return await apiClient.get("/notifications/message-recipients");
};
