import API from "./api";

// ================= GET ALL =================

export const fetchMortality = async () => {
  const res = await API.get("/mortality");

  return res.data;
};

// ================= CREATE =================

export const createMortality = async (data) => {
  const res = await API.post("/mortality", data);

  return res.data;
};

// ================= DELETE =================

export const deleteMortality = async (id) => {
  const res = await API.delete(`/mortality/${id}`);

  return res.data;
};

// ================= UPDATE =================

export const updateMortality = async (id, data) => {
  const res = await API.put(`/mortality/${id}`, data);

  return res.data;
};
