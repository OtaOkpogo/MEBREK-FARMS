import apiClient from "./apiClient";

export const fetchReport = async (type, filters = {}) => {
  const params = new URLSearchParams();

  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.pen && filters.pen !== "All") params.append("pen", filters.pen);

  // apiClient's response interceptor already unwraps to response.data,
  // so the resolved value here IS the payload — don't destructure .data
  // again or it silently becomes undefined for array responses.
  const data = await apiClient.get(
    `/reports/${type}${params.toString() ? `?${params.toString()}` : ""}`,
  );

  return data;
};

export const getProductionReport = (filters = {}) =>
  fetchReport("production", filters);

export const getEggSalesReport = (filters = {}) =>
  fetchReport("eggsales", filters);

export const getFeedReport = (filters = {}) =>
  fetchReport("feedusage", filters);

export const getMortalityReport = (filters = {}) =>
  fetchReport("mortality", filters);

export const getVaccinationReport = (filters = {}) =>
  fetchReport("vaccination", filters);

export const getWarehouseReport = (filters = {}) =>
  fetchReport("warehouse", filters);

export const getStaffReport = (filters = {}) => fetchReport("staff", filters);
