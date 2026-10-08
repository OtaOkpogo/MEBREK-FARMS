import api from "./api";

// =====================================================
// GET ALL SALES
// =====================================================

export const fetchSales = async () => {
  const res = await api.get("/egg-sales");

  return res.data;
};

// =====================================================
// GET SINGLE SALE
// =====================================================

export const fetchSale = async (id) => {
  const res = await api.get(`/egg-sales/${id}`);

  return res.data;
};

// =====================================================
// GET SALES FOR CUSTOMER
// =====================================================

export const fetchCustomerSales = async (customerId) => {
  const res = await api.get(`/egg-sales/customer/${customerId}`);

  return res.data;
};

// =====================================================
// CREATE SALE
// =====================================================

export const createSale = async (data) => {
  const res = await api.post("/egg-sales", data);

  return res.data;
};

// =====================================================
// UPDATE SALE
// =====================================================

export const updateSale = async (id, data) => {
  const res = await api.put(`/egg-sales/${id}`, data);

  return res.data;
};

// =====================================================
// DELETE SALE
// =====================================================

export const deleteSale = async (id) => {
  const res = await api.delete(`/egg-sales/${id}`);

  return res.data;
};

// =====================================================
// GET DELETED SALES
// =====================================================

export const fetchDeletedSales = async () => {
  const res = await api.get("/egg-sales/deleted");

  return res.data;
};

// =====================================================
// RESTORE SALE
// =====================================================

export const restoreSale = async (id) => {
  const res = await api.put(`/egg-sales/${id}/restore`);

  return res.data;
};
