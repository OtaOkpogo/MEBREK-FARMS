import apiClient from "./apiClient";

export const fetchProductions =
  async () => {
    return await apiClient.get(
      "/production"
    );
  };

export const createProduction =
  async (data) => {
    return await apiClient.post(
      "/production",
      data
    );
  };

export const deleteProduction =
  async (id) => {
    return await apiClient.delete(
      `/production/${id}`
    );
  };
