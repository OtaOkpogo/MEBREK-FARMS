import apiClient from "./apiClient";

// ==========================
// GET ALL BIRD HEALTH RECORDS
// ==========================

export const fetchBirdHealth = async () => {
  return await apiClient.get("/bird-health");
};

// ==========================
// CREATE RECORD
// ==========================

export const createBirdHealth = async (data) => {
  return await apiClient.post("/bird-health", data);
};

// ==========================
// UPDATE RECORD
// ==========================

export const updateBirdHealth = async (id, data) => {
  return await apiClient.put(`/bird-health/${id}`, data);
};

// ==========================
// DELETE RECORD (SOFT DELETE)
// ==========================

export const deleteBirdHealth = async (id) => {
  return await apiClient.delete(`/bird-health/${id}`);
};

// ==========================
// RESTORE RECORD
// ==========================

export const restoreBirdHealth = async (id) => {
  return await apiClient.put(`/bird-health/${id}/restore`);
};

// ==========================
// GET DELETED RECORDS
// ==========================

export const fetchDeletedBirdHealth = async () => {
  return await apiClient.get("/bird-health/deleted");
};
