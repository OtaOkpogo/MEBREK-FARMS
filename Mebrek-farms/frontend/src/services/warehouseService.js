import axios from "axios";

const API_URL =
  "http://localhost:5000/api/warehouse";


const getConfig = () => {
  const token =
    localStorage.getItem("token");

  return {
    headers: {
      Authorization: token,
    },
  };
};


// ================= GET =================

export const fetchWarehouse =
  async () => {
    const res = await axios.get(
      API_URL,
      getConfig()
    );

    return res.data;
  };


// ================= CREATE =================

export const createWarehouseItem =
  async (data) => {
    const res = await axios.post(
      API_URL,
      data,
      getConfig()
    );

    return res.data;
  };


// ================= UPDATE =================

export const updateWarehouseItem =
  async (id, data) => {
    const res = await axios.put(
      `${API_URL}/${id}`,
      data,
      getConfig()
    );

    return res.data;
  };


// ================= DELETE =================

export const deleteWarehouseItem =
  async (id) => {
    const res = await axios.delete(
      `${API_URL}/${id}`,
      getConfig()
    );

    return res.data;
  };
