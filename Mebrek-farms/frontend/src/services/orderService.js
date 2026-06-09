import apiClient from "./apiClient";

export const fetchOrders = () =>
  apiClient.get("/orders");
