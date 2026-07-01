import apiClient from "./apiClient";

// ==========================
// SEND MESSAGE TO SUPER ADMIN
// ==========================
export const sendNotification = async (message) => {
  const { data } = await apiClient.post("/notifications", {
    message,
  });

  return data;
};

// ==========================
// GET MY NOTIFICATIONS
// ==========================
export const getNotifications = async () => {
  const { data } = await apiClient.get("/notifications");

  return data;
};

// ==========================
// MARK AS READ
// ==========================
export const markNotificationAsRead = async (id) => {
  const { data } = await apiClient.put(`/notifications/${id}/read`);

  return data;
};

// ==========================
// DELETE NOTIFICATION
// ==========================
export const deleteNotification = async (id) => {
  const { data } = await apiClient.delete(`/notifications/${id}`);

  return data;
};
