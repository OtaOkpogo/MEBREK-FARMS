import apiClient from "./apiClient";

// Get all rooms
export const getRooms = async () => {
  const res = await apiClient.get("/room-inventory");
  return res.data;
};

// Get one room
export const getRoom = async (id) => {
  const res = await apiClient.get(`/room-inventory/${id}`);
  return res.data;
};

// Create room
export const createRoom = async (data) => {
  const res = await apiClient.post("/room-inventory", data);
  return res.data;
};

// Update room
export const updateRoom = async (id, data) => {
  const res = await apiClient.put(`/room-inventory/${id}`, data);
  return res.data;
};

// Delete room
export const deleteRoom = async (id) => {
  const res = await apiClient.delete(`/room-inventory/${id}`);
  return res.data;
};

// Add item
export const addItem = async (roomId, data) => {
  const res = await apiClient.post(
    `/room-inventory/${roomId}/items`,
    data,
  );

  return res.data;
};

// Update item
export const updateItem = async (
  roomId,
  itemId,
  data,
) => {
  const res = await apiClient.put(
    `/room-inventory/${roomId}/items/${itemId}`,
    data,
  );

  return res.data;
};

// Delete item
export const deleteItem = async (
  roomId,
  itemId,
) => {
  const res = await apiClient.delete(
    `/room-inventory/${roomId}/items/${itemId}`,
  );

  return res.data;
};
