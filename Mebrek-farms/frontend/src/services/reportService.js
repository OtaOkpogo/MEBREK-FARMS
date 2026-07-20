import apiClient from "./apiClient";

/**
 * Fetch report data from the backend.
 * @param {string} type
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
export const fetchReport = async (type, filters = {}) => {
  try {
    const params = new URLSearchParams();

    if (filters.startDate) {
      params.append("startDate", filters.startDate);
    }

    if (filters.endDate) {
      params.append("endDate", filters.endDate);
    }

    if (filters.pen && filters.pen !== "All") {
      params.append("pen", filters.pen);
    }

    const url = `/reports/${type}${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const { data } = await apiClient.get(url);

    return data;
  } catch (error) {
    console.error("Report fetch error:", error);
    throw error;
  }
};
