import apiClient from "./apiClient";

// Get notifications
export const getNotifications = async () => {
  return await apiClient.get("/notifications");
};

// Send notification
export const sendNotification = async (data) => {
  return await apiClient.post("/notifications", data);
};

// Mark one notification as read
export const markNotificationRead = async (id) => {
  return await apiClient.put(`/notifications/${id}/read`);
};

//Reply notification
export const replyNotification = async (id, data) => {
  return await apiClient.post(`/notifications/${id}/reply`, data);
};
