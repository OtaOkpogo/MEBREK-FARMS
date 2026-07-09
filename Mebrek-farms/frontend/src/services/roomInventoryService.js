import apiClient from "./apiClient";

/*
|--------------------------------------------------------------------------
| ROOM INVENTORY SERVICE
|--------------------------------------------------------------------------
| This service matches your current backend routes:
|
| GET    /api/room-inventory
| GET    /api/room-inventory/:id
| POST   /api/room-inventory
| PUT    /api/room-inventory/:id
| DELETE /api/room-inventory/:id
| PATCH  /api/room-inventory/:id/assign
| PATCH  /api/room-inventory/:id/status
| GET    /api/room-inventory/summary
| GET    /api/room-inventory/missing
|
|--------------------------------------------------------------------------
*/

// ==============================
// INVENTORY ITEMS
// ==============================

// Get every inventory item
export const getRooms = async () => {
  return await apiClient.get("/room-inventory");
};

// Get one inventory item
export const getRoom = async (id) => {
  return await apiClient.get(`/room-inventory/${id}`);
};

// Create inventory item
export const addItem = async (data) => {
  return await apiClient.post("/room-inventory", data);
};

// Update inventory item
export const updateItem = async (id, data) => {
  return await apiClient.put(`/room-inventory/${id}`, data);
};

// Delete inventory item
export const deleteItem = async (id) => {
  return await apiClient.delete(`/room-inventory/${id}`);
};

// ==============================
// ROOM SUMMARY
// ==============================

export const getInventorySummary = async () => {
  return await apiClient.get("/room-inventory/summary");
};

// Missing items

export const getMissingItems = async () => {
  return await apiClient.get("/room-inventory/missing");
};

// Assign item to staff

export const assignItem = async (id, staffId) => {
  return await apiClient.patch(`/room-inventory/${id}/assign`, {
    staffId,
  });
};

// Change status

export const updateItemStatus = async (id, status, note = "") => {
  return await apiClient.patch(`/room-inventory/${id}/status`, {
    status,
    note,
  });
};
