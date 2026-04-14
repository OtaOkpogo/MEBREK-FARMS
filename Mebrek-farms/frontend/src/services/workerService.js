import axios from "axios";

const API_URL = "http://localhost:5000/api/workers";

// Helper: attach token
const getConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: token,
    },
  };
};

// ✅ Get All Workers
export const fetchWorkers = async () => {
  const res = await axios.get(API_URL, getConfig());
  return res.data;
};

// ✅ Create Worker
export const createWorker = async (workerData) => {
  const res = await axios.post(API_URL, workerData, getConfig());
  return res.data;
};

// ✅ Update Worker
export const updateWorker = async (id, workerData) => {
  const res = await axios.put(`${API_URL}/${id}`, workerData, getConfig());
  return res.data;
};

// ✅ Delete Woker
export const deleteWorker = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`, getConfig());
  return res.data;
};
