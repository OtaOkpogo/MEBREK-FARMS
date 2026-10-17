import api from "./api";

// ============================================================
// EGG SALES SERVICE
// ============================================================

// Fetch sales visible to the logged-in user
export const fetchSales = async (params = {}) => {
  const res = await api.get("/egg-sales", { params });
  return res.data;
};

// Fetch outstanding customers
export const fetchOutstandingCustomers = async (params = {}) => {
  const res = await api.get("/egg-sales/outstanding", { params });
  return res.data;
};

// Fetch one sale
export const fetchSale = async (id) => {
  const res = await api.get(`/egg-sales/${id}`);
  return res.data;
};

// Fetch sales belonging to a customer
// Backend route: GET /api/egg-sales/customer/:customerId
export const fetchCustomerSales = async (customerId, params = {}) => {
  if (!customerId) {
    throw new Error("A customer ID is required to fetch customer sales.");
  }

  const res = await api.get(
    `/egg-sales/customer/${encodeURIComponent(customerId)}`,
    { params },
  );

  return res.data;
};

// Create a sale
export const createSale = async (saleData) => {
  const res = await api.post("/egg-sales", saleData);
  return res.data;
};

// Update a sale
export const updateSale = async (id, saleData) => {
  const res = await api.put(`/egg-sales/${id}`, saleData);
  return res.data;
};

// Delete a sale
export const deleteSale = async (id) => {
  const res = await api.delete(`/egg-sales/${id}`);
  return res.data;
};

// Fetch deleted sales
export const fetchDeletedSales = async (params = {}) => {
  const res = await api.get("/egg-sales/deleted", { params });
  return res.data;
};

// Restore a deleted sale
export const restoreSale = async (id) => {
  const res = await api.put(`/egg-sales/${id}/restore`);
  return res.data;
};

// ============================================================
// OLDER-SALE ACCESS REQUESTS
// ============================================================

// Request access to an older sale
export const requestOlderSaleAccess = async (requestData) => {
  const res = await api.post("/sale-access-requests", {
    ...requestData,
    saleType: "egg",
  });

  return res.data;
};

// Fetch older-sale access requests
export const fetchSaleAccessRequests = async (params = {}) => {
  const res = await api.get("/sale-access-requests", {
    params: { ...params, saleType: "egg" },
  });

  return res.data;
};

// Approve or reject an older-sale access request
export const reviewSaleAccessRequest = async (id, reviewData) => {
  const res = await api.put(`/sale-access-requests/${id}/review`, {
    ...reviewData,
    saleType: "egg",
  });

  return res.data;
};

// Delete an older-sale access request
export const deleteSaleAccessRequest = async (id) => {
  const res = await api.delete(`/sale-access-requests/${id}`, {
    params: { saleType: "egg" },
  });

  return res.data;
};

/**
 * Mark an older-sale access request as viewed.
 * Requires a matching backend endpoint.
 */
export const markSaleAccessRequestViewed = async (id) => {
  const res = await api.put(
    `/sale-access-requests/${id}/viewed`,
    { saleType: "egg" },
    { params: { saleType: "egg" } },
  );

  return res.data;
};
