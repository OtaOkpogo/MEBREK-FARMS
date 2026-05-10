import axios from "axios";

const API_URL =
  "http://localhost:5000/api/feed-invoices";

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
  const res = await axios.get(
    API_URL,
    getConfig()
  );

  return res.data;
};


// CREATE INVOICE
export const createInvoice = async (
  invoiceData
) => {
  const res = await axios.post(
    API_URL,
    invoiceData,
    getConfig()
  );

  return res.data;
};


// DELETE INVOICE
export const deleteInvoice = async (id) => {
  const res = await axios.delete(
    `${API_URL}/${id}`,
    getConfig()
  );

  return res.data;
};
