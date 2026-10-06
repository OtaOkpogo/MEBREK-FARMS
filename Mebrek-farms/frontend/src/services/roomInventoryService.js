import apiClient from "./apiClient";

// ============================================================
// INVENTORY ITEMS
// ============================================================

// Get every inventory item
export const getRooms = async () => {
  const response = await apiClient.get("/room-inventory");
  return response.data;
};

// Get one inventory item
export const getRoom = async (id) => {
  const response = await apiClient.get(`/room-inventory/${id}`);
  return response.data;
};

// Create inventory item
export const addItem = async (data) => {
  const response = await apiClient.post("/room-inventory", data);
  return response.data;
};

// Update inventory item
export const updateItem = async (id, data) => {
  const response = await apiClient.put(`/room-inventory/${id}`, data);
  return response.data;
};

// Delete inventory item
export const deleteItem = async (id) => {
  const response = await apiClient.delete(`/room-inventory/${id}`);
  return response.data;
};

// ============================================================
// ROOM SUMMARY
// ============================================================

export const getInventorySummary = async () => {
  const response = await apiClient.get("/room-inventory/summary");
  return response.data;
};

// ============================================================
// MISSING ITEMS
// ============================================================

export const getMissingItems = async () => {
  const response = await apiClient.get("/room-inventory/missing");
  return response.data;
};

// ============================================================
// ASSIGN ITEM
// ============================================================

export const assignItem = async (id, staffId) => {
  const response = await apiClient.patch(`/room-inventory/${id}/assign`, {
    staffId,
  });

  return response.data;
};

// ============================================================
// CHANGE STATUS
// ============================================================

export const updateItemStatus = async (id, status, note = "") => {
  const response = await apiClient.patch(`/room-inventory/${id}/status`, {
    status,
    note,
  });

  return response.data;
};
