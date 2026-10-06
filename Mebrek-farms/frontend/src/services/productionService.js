import apiClient from "./apiClient";

export const fetchProductions = async () => {
  const response = await apiClient.get("/production");

  // Handle different possible backend response structures
  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.data?.productions)) {
    return response.data.productions;
  }

  if (Array.isArray(response.data?.data)) {
    return response.data.data;
  }

  return [];
};

export const fetchProduction = async (id) => {
  const response = await apiClient.get(`/production/${id}`);
  return response.data;
};

export const createProduction = async (data) => {
  const response = await apiClient.post("/production", data);
  return response.data;
};

export const updateProduction = async (id, data) => {
  const response = await apiClient.put(`/production/${id}`, data);
  return response.data;
};

export const deleteProduction = async (id) => {
  const response = await apiClient.delete(`/production/${id}`);
  return response.data;
};
