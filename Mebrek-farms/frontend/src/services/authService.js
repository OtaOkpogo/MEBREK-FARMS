import apiClient from "./apiClient";

export const getCurrentUser = async () => {
  const response = await apiClient.get("/auth/me");

  // Return the actual admin/user object
  return response.data?.admin || response.data?.user || response.data;
};
