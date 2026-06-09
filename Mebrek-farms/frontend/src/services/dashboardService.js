import apiClient from "./apiClient";

export const fetchDashboardData = () => apiClient.get("/dashboard");
