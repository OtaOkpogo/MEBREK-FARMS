import api from "./api";

export const getBirdHealthRecords = async () => {
  const res = await api.get("/bird-health");
  return res.data;
};

export const createBirdHealthRecord = async (data) => {
  const res = await api.post("/bird-health", data);
  return res.data;
};

export const updateBirdHealthRecord = async (id, data) => {
  const res = await api.put(`/bird-health/${id}`, data);
  return res.data;
};

export const deleteBirdHealthRecord = async (id) => {
  const res = await api.delete(`/bird-health/${id}`);
  return res.data;
};

export const getDeletedBirdHealthRecords = async () => {
  const res = await api.get("/bird-health/deleted");
  return res.data;
};

export const restoreBirdHealthRecord = async (id) => {
  const res = await api.put(`/bird-health/${id}/restore`);
  return res.data;
};
