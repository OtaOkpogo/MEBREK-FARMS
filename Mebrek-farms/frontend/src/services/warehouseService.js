import apiClient from "./apiClient";

// ================= GET =================

export const fetchWarehouse = () => apiClient.get("/warehouse");

// ================= CREATE =================

export const createWarehouseItem = (data) => apiClient.post("/warehouse", data);

// ================= UPDATE =================

export const updateWarehouseItem = (id, data) =>
  apiClient.put(`/warehouse/${id}`, data);

// ================= DELETE =================

export const deleteWarehouseItem = (id) => apiClient.delete(`/warehouse/${id}`);

export const restoreWarehouseItem = (id) =>
  apiClient.put(`/warehouse/${id}/restore`);
