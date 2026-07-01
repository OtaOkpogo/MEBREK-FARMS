import apiClient from "./apiClient";

// Get notifications
export const getNotifications = async () => {
  const res = await apiClient.get("/notifications");
  return res.data;
};

// Send notification
export const sendNotification = async (data) => {
  const res = await apiClient.post("/notifications", data);
  return res.data;
};

// Mark one notification as read
export const markNotificationRead = async (id) => {
  const res = await apiClient.put(`/notifications/${id}/read`);
  return res.data;
};
