import axios from "axios";

const API_URL = "http://localhost:5000/api/feed-invoices";

// ====================================== // AUTH CONFIG // ======================================

const getConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// GET INVOICES
export const fetchInvoices = async () => {
  const res = await axios.get(API_URL, getConfig());

  return res.data;
};

// CREATE INVOICE
export const createInvoice = async (invoiceData) => {
  const res = await axios.post(API_URL, invoiceData, getConfig());

  return res.data;
};

// DELETE INVOICE
export const deleteInvoice = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`, getConfig());

  return res.data;
};

// UPDATE
export const updateInvoice = async (id, data) => {
  const res = await axios.put(`${API_URL}/${id}`, data, getConfig());

  return res.data;
};

// RESTORE
export const restoreInvoice = async (id) => {
  const res = await axios.put(`${API_URL}/${id}/restore`, {}, getConfig());

  return res.data;
};

// GET DELETED
export const fetchDeletedInvoices = async () => {
  const res = await axios.get(`${API_URL}/deleted`, getConfig());

  return res.data;
};
