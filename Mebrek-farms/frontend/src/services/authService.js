import apiClient from "./apiClient";

export const getCurrentUser = async () => {
  return await apiClient.get("/auth/me");
};
