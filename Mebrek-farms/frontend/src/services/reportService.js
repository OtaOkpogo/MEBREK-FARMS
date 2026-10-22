import apiClient from "./apiClient";

// ============================================================
// GENERIC REPORT FETCHER
// ============================================================

export const fetchReport = async (type, filters = {}) => {
  const params = new URLSearchParams();

  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.pen && filters.pen !== "All") {
    params.append("pen", filters.pen);
  }

  // Keep the existing Axios response behavior for standard reports.
  const response = await apiClient.get(
    `/reports/${type}${params.toString() ? `?${params.toString()}` : ""}`,
  );

  return response;
};

// ============================================================
// STANDARD REPORTS
// ============================================================

export const getProductionReport = (filters = {}) =>
  fetchReport("production", filters);

export const getEggSalesReport = (filters = {}) =>
  fetchReport("eggsales", filters);

export const getManureSalesReport = (filters = {}) =>
  fetchReport("manuresales", filters);

export const getFeedReport = (filters = {}) =>
  fetchReport("feedusage", filters);

export const getMortalityReport = (filters = {}) =>
  fetchReport("mortality", filters);

export const getVaccinationReport = (filters = {}) =>
  fetchReport("vaccination", filters);

export const getWarehouseReport = (filters = {}) =>
  fetchReport("warehouse", filters);

export const getStaffReport = (filters = {}) => fetchReport("staff", filters);

// ============================================================
// PROFIT AND LOSS REPORT
// Superadmin-only access is enforced by the backend.
// ============================================================

export const getProfitLossReport = async (period) => {
  const params = new URLSearchParams();

  if (period && period !== "all") {
    params.append("period", period);
  }

  const query = params.toString();

  const response = await apiClient.get(
    `/reports/profitloss${query ? `?${query}` : ""}`,
  );

  // apiClient returns the full Axios response.
  // The report payload is inside response.data.
  return response.data;
};
