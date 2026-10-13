import api from "./api";

export const fetchSales = async () => {
  const res = await api.get("/egg-sales");
  return res.data;
};

export const fetchSale = async (id) => {
  const res = await api.get(`/egg-sales/${id}`);
  return res.data;
};

export const fetchCustomerSales = async (customerId) => {
  const res = await api.get(`/egg-sales/customer/${customerId}`);
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

// Older-sale access requests
export const requestOlderSaleAccess = async (payload) => {
  const res = await api.post("/sale-access-requests", {
    ...payload,
    saleType: "egg",
  });

  return res.data;
};

export const fetchSaleAccessRequests = async (params = {}) => {
  const res = await api.get("/sale-access-requests", {
    params: { ...params, saleType: "egg" },
  });

  return res.data;
};

export const reviewSaleAccessRequest = async (
  id,
  { decision, reviewNote = "" },
) => {
  const res = await api.put(`/sale-access-requests/${id}/review`, {
    decision,
    reviewNote,
  });

  return res.data;
};

export const markSaleAccessRequestViewed = async (id) => {
  const res = await api.patch(`/sale-access-requests/${id}/viewed`);
  return res.data;
};

// Managers may delete their own pending requests.
// Superadmins may delete requests in any status.
// The backend enforces these permissions.
export const deleteSaleAccessRequest = async (id) => {
  const res = await api.delete(`/sale-access-requests/${id}`);
  return res.data;
};
