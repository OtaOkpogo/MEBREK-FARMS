import apiClient from "./apiClient";

export const fetchDashboardData = async () => {
  const data = await apiClient.get("/dashboard");
  return data;
};
