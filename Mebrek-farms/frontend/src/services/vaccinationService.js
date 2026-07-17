import api from "./api";

export const fetchVaccinations = async () => {
  const res = await api.get("/vaccinations");
  return res.data;
};

export const createVaccination = async (data) => {
  const res = await api.post("/vaccinations", data);
  return res.data;
};

export const updateVaccination = async (id, data) => {
  const res = await api.put(`/vaccinations/${id}`, data);
  return res.data;
};

export const deleteVaccination = async (id) => {
  const res = await api.delete(`/vaccinations/${id}`);
  return res.data;
};

export const fetchDeletedVaccinations = async () => {
  const res = await api.get("/vaccinations/deleted");
  return res.data;
};

export const restoreVaccination = async (id) => {
  const res = await api.put(`/vaccinations/${id}/restore`);
  return res.data;
};
