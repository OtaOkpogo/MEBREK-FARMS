import API from "./api";

// ================= GET ALL =================

export const fetchVaccinations = async () => {
  const res = await API.get("/vaccinations");

  return res.data;
};

// ================= CREATE =================

export const createVaccination = async (data) => {
  const res = await API.post("/vaccinations", data);

  return res.data;
};

// ================= DELETE =================

export const deleteVaccination = async (id) => {
  const res = await API.delete(`/vaccinations/${id}`);

  return res.data;
};

// ================= UPDATE =================

export const updateVaccination = async (id, data) => {
  const res = await API.put(`/vaccinations/${id}`, data);

  return res.data;
};
