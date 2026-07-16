import api from "./api";

export const getMedications = async () => {
  const res = await api.get("/medications");
  return res.data;
};

export const createMedication = async (data) => {
  const res = await api.post("/medications", data);
  return res.data;
};

export const updateMedication = async (id, data) => {
  const res = await api.put(`/medications/${id}`, data);
  return res.data;
};

export const deleteMedication = async (id) => {
  const res = await api.delete(`/medications/${id}`);
  return res.data;
};

export const getDeletedMedications = async () => {
  const res = await api.get("/medications/deleted");
  return res.data;
};

export const restoreMedication = async (id) => {
  const res = await api.put(`/medications/${id}/restore`);
  return res.data;
};

