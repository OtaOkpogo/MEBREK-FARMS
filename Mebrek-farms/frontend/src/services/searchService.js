import apiClient from "./apiClient";

const EMPTY_RESULT = {
  workers: [],
  production: [],
  eggSales: [],
  feedInventory: [],
  roomInventory: [],
  notifications: [],
  warehouse: [],
  orders: [],
  vaccinations: [],
  medications: [],
};

export const globalSearch = async (query) => {
  const searchTerm = String(query || "").trim();

  if (searchTerm.length < 2) {
    return EMPTY_RESULT;
  }

  const response = await apiClient.get("/search", {
    params: { q: searchTerm },
  });

  return response.data || EMPTY_RESULT;
};
