import apiClient from "./apiClient";

// ===============================
// GET ALL SALES
// ===============================
export const fetchSales = async () => {
  return await apiClient.get("/egg-sales");
};

// ===============================
// GET ONE SALE
// ===============================
export const fetchSale = async (id) => {
  return await apiClient.get(`/egg-sales/${id}`);
};

// ===============================
// CREATE SALE
// ===============================
export const createSale = async (saleData) => {
  return await apiClient.post("/egg-sales", saleData);
};

// ===============================
// UPDATE SALE
// ===============================
export const updateSale = async (id, saleData) => {
  return await apiClient.put(`/egg-sales/${id}`, saleData);
};

// ===============================
// DELETE SALE
// ===============================
export const deleteSale = async (id) => {
  return await apiClient.delete(`/egg-sales/${id}`);
};
