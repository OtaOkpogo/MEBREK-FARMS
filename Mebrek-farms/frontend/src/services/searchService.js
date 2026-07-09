import apiClient from "./apiClient";

/**
 * Global Search
 * GET /api/search?q=keyword
 */
export const globalSearch = async (query) => {
  if (!query || query.trim().length < 2) {
    return {
      workers: [],
      production: [],
      eggSales: [],
      feedInventory: [],
      roomInventory: [],
      notifications: [],
    };
  }

  const response = await apiClient.get("/search", {
    params: {
      q: query.trim(),
    },
  });

  // apiClient already returns response.data
  return response;
};
