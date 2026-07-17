import api from "./api";

export const fetchSales = async () => {
  const res = await api.get("/egg-sales");
  return res.data;
};

export const createSale = async (data) => {
  const res = await api.post("/egg-sales", data);
  return res.data;
};

export const updateSale = async (id, data) => {
  const res = await api.put(`/egg-sales/${id}`, data);
  return res.data;
};

export const deleteSale = async (id) => {
  const res = await api.delete(`/egg-sales/${id}`);
  return res.data;
};

export const fetchDeletedSales = async () => {
  const res = await api.get("/egg-sales/deleted");
  return res.data;
};

export const restoreSale = async (id) => {
  const res = await api.put(`/egg-sales/${id}/restore`);
  return res.data;
};
