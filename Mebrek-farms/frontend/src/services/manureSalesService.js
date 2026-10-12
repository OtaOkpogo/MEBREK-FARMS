import api from "./api";

export const fetchSales = async () => {
  const res = await api.get("/manure-sales");
  return res.data;
};

export const createSale = async (data) => {
  const res = await api.post("/manure-sales", data);
  return res.data;
};

export const updateSale = async (id, data) => {
  const res = await api.put(`/manure-sales/${id}`, data);
  return res.data;
};

export const deleteSale = async (id) => {
  const res = await api.delete(`/manure-sales/${id}`);
  return res.data;
};

export const fetchDeletedSales = async () => {
  const res = await api.get("/manure-sales/deleted");
  return res.data;
};

export const restoreSale = async (id) => {
  const res = await api.put(`/manure-sales/${id}/restore`);
  return res.data;
};

// =====================================================
// OLDER-SALE ACCESS REQUESTS
// Requires the backend /api/sale-access-requests endpoints.
// =====================================================
export const requestOlderSaleAccess = async ({ invoiceNumber, reason }) => {
  const res = await api.post("/sale-access-requests", {
    saleType: "manure",
    invoiceNumber: String(invoiceNumber || "").trim(),
    reason: String(reason || "").trim(),
  });
  return res.data;
};

export const fetchSaleAccessRequests = async (params = {}) => {
  const res = await api.get("/sale-access-requests", {
    params: { ...params, saleType: "manure" },
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
