import apiClient from "./apiClient";

// ============================================================
// FETCH ACTIVE EXPENSES
// SERVER-SIDE PAGINATION + FILTERING
// ============================================================

export const fetchExpenses = async ({
  page = 1,
  limit = 10,
  search = "",
  category = "All",
  paymentMethod = "All",
  startDate = "",
  endDate = "",
} = {}) => {
  const params = {
    page,
    limit,
  };

  if (search?.trim()) {
    params.search = search.trim();
  }

  if (category && category !== "All") {
    params.category = category;
  }

  if (paymentMethod && paymentMethod !== "All") {
    params.paymentMethod = paymentMethod;
  }

  if (startDate) {
    params.startDate = startDate;
  }

  if (endDate) {
    params.endDate = endDate;
  }

  const res = await apiClient.get("/expenses", {
    params,
  });

  const data = res?.data ?? res;

  if (data && typeof data === "object" && Array.isArray(data.expenses)) {
    return data;
  }

  // ----------------------------------------------------------
  // Backward compatibility
  // ----------------------------------------------------------

  if (Array.isArray(data)) {
    return {
      expenses: data,
      pagination: {
        page: 1,
        limit: data.length || limit,
        totalRecords: data.length,
        totalPages: data.length > 0 ? 1 : 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {
        search,
        category,
        paymentMethod,
        startDate,
        endDate,
      },
    };
  }

  console.warn("Unexpected expenses response:", data);

  return {
    expenses: [],
    pagination: {
      page: 1,
      limit,
      totalRecords: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    filters: {
      search,
      category,
      paymentMethod,
      startDate,
      endDate,
    },
  };
};

// ============================================================
// CREATE EXPENSE
// ============================================================

export const createExpense = async (data) => {
  const res = await apiClient.post("/expenses", data);

  return res?.data ?? res;
};

// ============================================================
// UPDATE EXPENSE
// ============================================================

export const updateExpense = async (id, data) => {
  if (!id) {
    throw new Error("Expense ID is required for update.");
  }

  const res = await apiClient.put(`/expenses/${id}`, data);

  return res?.data ?? res;
};

// ============================================================
// DELETE EXPENSE
// ============================================================

export const deleteExpense = async (id) => {
  if (!id) {
    throw new Error("Expense ID is required for deletion.");
  }

  const res = await apiClient.delete(`/expenses/${id}`);

  return res?.data ?? res;
};

// ============================================================
// FETCH DELETED EXPENSES
// ============================================================

export const fetchDeletedExpenses = async () => {
  const res = await apiClient.get("/expenses/deleted");

  const data = res?.data ?? res;

  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.expenses)) {
    return data.expenses;
  }

  if (data && Array.isArray(data.data)) {
    return data.data;
  }

  console.warn("Unexpected deleted expenses response:", data);

  return [];
};

// ============================================================
// RESTORE EXPENSE
// ============================================================

export const restoreExpense = async (id) => {
  if (!id) {
    throw new Error("Expense ID is required for restoration.");
  }

  const res = await apiClient.patch(`/expenses/${id}/restore`);

  return res?.data ?? res;
};

// ============================================================
// BASIC STATS
// ============================================================

export const fetchExpenseStats = async () => {
  const res = await apiClient.get("/expenses/stats");

  const data = res?.data ?? res;

  return data && typeof data === "object" ? data : {};
};

// ============================================================
// SERVER-SIDE FINANCIAL REPORT
// ============================================================

export const fetchExpenseReport = async ({
  startDate = "",
  endDate = "",
  category = "All",
  paymentMethod = "All",
} = {}) => {
  const params = {};

  if (startDate) {
    params.startDate = startDate;
  }

  if (endDate) {
    params.endDate = endDate;
  }

  if (category && category !== "All") {
    params.category = category;
  }

  if (paymentMethod && paymentMethod !== "All") {
    params.paymentMethod = paymentMethod;
  }

  const res = await apiClient.get("/expenses/report", {
    params,
  });

  const data = res?.data ?? res;

  if (!data || typeof data !== "object") {
    console.warn("Unexpected expense report response:", data);

    return {
      filters: {},
      summary: {
        totalExpenses: 0,
        totalAmount: 0,
        averageExpense: 0,
        largestExpense: 0,
      },
      categoryBreakdown: [],
      paymentMethodBreakdown: [],
      monthlyTrend: [],
    };
  }

  return data;
};
