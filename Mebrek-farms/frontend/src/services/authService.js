import apiClient from "./apiClient";

export const getCurrentUser = async () => {
  const res = await apiClient.get("/auth/me");

  return res.data || res;
};
