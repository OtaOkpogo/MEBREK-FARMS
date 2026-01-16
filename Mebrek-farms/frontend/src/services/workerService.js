import api from "./api";

export const fetchWorkers = async () => {
  const response = await api.get("/workers");
  return response.data;
};

export const addWorker = async (workerData) => {
  const response = await api.post("/workers", workerData);
  return response.data;
};
