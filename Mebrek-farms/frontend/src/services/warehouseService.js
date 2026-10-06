import apiClient from "./apiClient";

// ================= GET WAREHOUSE ITEMS =================

export const fetchWarehouse = async () => {
  const response = await apiClient.get("/warehouse");
  return response.data;
};

// ================= CREATE WAREHOUSE ITEM =================

export const createWarehouseItem = async (data) => {
  const response = await apiClient.post("/warehouse", data);
  return response.data;
};

// ================= UPDATE WAREHOUSE ITEM =================

export const updateWarehouseItem = async (id, data) => {
  const response = await apiClient.put(`/warehouse/${id}`, data);
  return response.data;
};

// ================= DELETE WAREHOUSE ITEM =================

export const deleteWarehouseItem = async (id) => {
  const response = await apiClient.delete(`/warehouse/${id}`);
  return response.data;
};

// ================= RESTORE WAREHOUSE ITEM =================

export const restoreWarehouseItem = async (id) => {
  const response = await apiClient.put(`/warehouse/${id}/restore`);
  return response.data;
};
