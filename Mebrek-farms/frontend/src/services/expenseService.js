import apiClient from "./apiClient";

export const fetchExpenses = async () => {
  const res = await apiClient.get("/expenses");
  return res;
};

export const createExpense = async (data) => {
  const res = await apiClient.post("/expenses", data);
  return res;
};

export const deleteExpense = async (id) => {
  const res = await apiClient.delete(`/expenses/${id}`);
  return res;
};

export const fetchExpenseStats = async () => {
  const res = await apiClient.get("/expenses/stats");
  return res;
};
