import apiClient from "./apiClient";

// FETCH ALL WORKERS
export const fetchWorkers = async () => {
  const res = await apiClient.get("/workers");

  // normalize all possible backend response shapes
  return res?.workers || res?.data?.workers || res?.data || res || [];
};

export const fetchWorkerStats = async () => {
  return await apiClient.get("/workers/stats");
};

// CREATE WORKER
export const createWorker = async (data) => {
  return await apiClient.post("/workers", data);
};

// UPDATE WORKER
export const updateWorker = async (id, data) => {
  return await apiClient.put(`/workers/${id}`, data);
};

// DELETE WORKER
export const deleteWorker = async (id) => {
  return await apiClient.delete(`/workers/${id}`);
};
