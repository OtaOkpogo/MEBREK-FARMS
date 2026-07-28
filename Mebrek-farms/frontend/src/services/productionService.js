import apiClient from "./apiClient";

export const fetchProductions = async () => {
  return await apiClient.get("/production");
};

export const fetchProduction = async (id) => {
  return await apiClient.get(`/production/${id}`);
};

export const createProduction = async (data) => {
  return await apiClient.post("/production", data);
};

export const updateProduction = async (id, data) => {
  return await apiClient.put(`/production/${id}`, data);
};

export const deleteProduction = async (id) => {
  return await apiClient.delete(`/production/${id}`);
};
