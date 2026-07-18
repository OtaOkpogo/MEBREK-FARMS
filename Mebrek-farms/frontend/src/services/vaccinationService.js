import axios from "axios";

const API_URL = "http://localhost:5000/api/vaccinations";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// ================= GET VACCINATIONS =================
export const fetchVaccinations = async () => {
  const res = await axios.get(API_URL, getAuthHeaders());
  return res.data;
};

// ================= CREATE VACCINATION =================
export const createVaccination = async (data) => {
  const res = await axios.post(API_URL, data, getAuthHeaders());
  return res.data;
};

// ================= UPDATE VACCINATION =================
export const updateVaccination = async (id, data) => {
  const res = await axios.put(`${API_URL}/${id}`, data, getAuthHeaders());
  return res.data;
};

// ================= DELETE VACCINATION (SOFT DELETE) =================
export const deleteVaccination = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`, getAuthHeaders());
  return res.data;
};

// ================= RESTORE VACCINATION (SUPER ADMIN ONLY) =================
export const restoreVaccination = async (id) => {
  const res = await axios.patch(
    `${API_URL}/${id}/restore`,
    {},
    getAuthHeaders(),
  );
  return res.data;
};
