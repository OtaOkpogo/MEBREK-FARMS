import axios from "axios";

const API_URL =
  "http://localhost:5000/api/dashboard";


// ================= TOKEN CONFIG =================

const getConfig = () => {

  const token =
    localStorage.getItem("token");

  return {
    headers: {
      Authorization: token,
    },
  };
};


// ================= FETCH DASHBOARD =================

export const fetchDashboardData =
  async () => {

    const res = await axios.get(
      API_URL,
      getConfig()
    );

    return res.data;
  };
