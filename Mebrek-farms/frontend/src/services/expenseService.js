import apiClient from "./apiClient";

// ============================================================
// RESPONSE NORMALIZER
// Supports apiClient instances that return either response.data
// directly or the full Axios response.
// ============================================================

const getResponseData = (response) => response?.data ?? response;

// ============================================================
// PAYROLL VALIDATION HELPERS
// ============================================================

const isValidSalaryPeriod = (salaryPeriod) =>
  typeof salaryPeriod === "string" &&
  /^\d{4}-(0[1-9]|1[0-2])$/.test(salaryPeriod);

const validateSalaryPeriod = (salaryPeriod) => {
  if (!isValidSalaryPeriod(salaryPeriod)) {
    throw new Error("A valid payroll month is required (YYYY-MM).");
  }
};

const validatePositiveAmount = (value, message) => {
  const amount = Number(value);

  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(message);
  }

  return amount;
};

const validatePaymentMethod = (paymentMethod) => {
  if (!["Cash", "Transfer", "POS"].includes(paymentMethod)) {
    throw new Error("Please select a valid payment method.");
  }
};

// ============================================================
// FETCH ACTIVE EXPENSES
// GET /api/expenses
// Server-side pagination and filtering
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
  const params = { page, limit };

  if (search?.trim()) params.search = search.trim();
  if (category && category !== "All") params.category = category;
  if (paymentMethod && paymentMethod !== "All") {
    params.paymentMethod = paymentMethod;
  }
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const response = await apiClient.get("/expenses", { params });
  const data = getResponseData(response);

  if (data && typeof data === "object" && Array.isArray(data.expenses)) {
    return data;
  }

  if (Array.isArray(data)) {
    return {
      expenses: data,
      pagination: {
        page: 1,
        limit: data.length || limit,
        totalRecords: data.length,
        totalPages: data.length ? 1 : 0,
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
// CREATE GENERAL EXPENSE
// POST /api/expenses
// ============================================================

export const createExpense = async (data) => {
  const response = await apiClient.post("/expenses", data);
  return getResponseData(response);
};

// ============================================================
// UPDATE EXPENSE
// PUT /api/expenses/:id
// ============================================================

export const updateExpense = async (id, data) => {
  if (!id) {
    throw new Error("Expense ID is required for update.");
  }

  const response = await apiClient.put(`/expenses/${id}`, data);
  return getResponseData(response);
};

// ============================================================
// DELETE EXPENSE
// DELETE /api/expenses/:id
// ============================================================

export const deleteExpense = async (id) => {
  if (!id) {
    throw new Error("Expense ID is required for deletion.");
  }

  const response = await apiClient.delete(`/expenses/${id}`);
  return getResponseData(response);
};

// ============================================================
// FETCH DELETED EXPENSES
// GET /api/expenses/deleted
// ============================================================

export const fetchDeletedExpenses = async () => {
  const response = await apiClient.get("/expenses/deleted");
  const data = getResponseData(response);

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.expenses)) return data.expenses;
  if (Array.isArray(data?.data)) return data.data;

  console.warn("Unexpected deleted expenses response:", data);
  return [];
};

// ============================================================
// RESTORE EXPENSE
// PATCH /api/expenses/:id/restore
// ============================================================

export const restoreExpense = async (id) => {
  if (!id) {
    throw new Error("Expense ID is required for restoration.");
  }

  const response = await apiClient.patch(`/expenses/${id}/restore`);
  return getResponseData(response);
};

// ============================================================
// BASIC EXPENSE STATISTICS
// GET /api/expenses/stats
// ============================================================

export const fetchExpenseStats = async () => {
  const response = await apiClient.get("/expenses/stats");
  const data = getResponseData(response);

  return data && typeof data === "object" ? data : {};
};

// ============================================================
// SERVER-SIDE FINANCIAL REPORT
// GET /api/expenses/report
// ============================================================

export const fetchExpenseReport = async ({
  startDate = "",
  endDate = "",
  category = "All",
  paymentMethod = "All",
} = {}) => {
  const params = {};

  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  if (category && category !== "All") params.category = category;
  if (paymentMethod && paymentMethod !== "All") {
    params.paymentMethod = paymentMethod;
  }

  const response = await apiClient.get("/expenses/report", { params });
  const data = getResponseData(response);

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

// ============================================================
// PAYROLL: FETCH WORKERS AND MONTHLY SALARY BALANCES
// GET /api/expenses/payroll/workers?salaryPeriod=YYYY-MM
// ============================================================

export const fetchPayrollWorkers = async (salaryPeriod) => {
  validateSalaryPeriod(salaryPeriod);

  const response = await apiClient.get("/expenses/payroll/workers", {
    params: { salaryPeriod },
  });

  const data = getResponseData(response);

  if (Array.isArray(data)) {
    return {
      salaryPeriod,
      workers: data,
      summary: {},
    };
  }

  if (data && typeof data === "object") {
    return {
      ...data,
      salaryPeriod: data.salaryPeriod || salaryPeriod,
      workers: Array.isArray(data.workers) ? data.workers : [],
      summary:
        data.summary && typeof data.summary === "object" ? data.summary : {},
    };
  }

  return {
    salaryPeriod,
    workers: [],
    summary: {},
  };
};

// ============================================================
// PAYROLL: SAVE AGREED MONTHLY SALARY
// POST /api/expenses/payroll/salary
//
// Saves the agreed salary for one worker and one month.
// Saving a salary does NOT record a payment or expense.
// ============================================================

export const setPayrollSalary = async ({
  workerId,
  salaryPeriod,
  salaryAmount,
}) => {
  if (!workerId) {
    throw new Error("Please select a worker.");
  }

  validateSalaryPeriod(salaryPeriod);

  const numericSalary = validatePositiveAmount(
    salaryAmount,
    "The agreed monthly salary must be greater than zero.",
  );

  const response = await apiClient.post("/expenses/payroll/salary", {
    workerId,
    salaryPeriod,
    salaryAmount: numericSalary,
  });

  return getResponseData(response);
};

// ============================================================
// PAYROLL: RECORD INDIVIDUAL SALARY PAYMENT
// POST /api/expenses/payroll/payment
//
// amount = actual money paid now.
// salaryAmount = agreed monthly salary, when supplied.
// ============================================================

export const createSalaryPayment = async ({
  workerId,
  salaryPeriod,
  salaryAmount,
  amount,
  paymentMethod,
  date,
  remarks = "",
}) => {
  if (!workerId) {
    throw new Error("Please select a worker.");
  }

  validateSalaryPeriod(salaryPeriod);
  validatePaymentMethod(paymentMethod);

  const numericAmount = validatePositiveAmount(
    amount,
    "Salary payment must be greater than zero.",
  );

  const payload = {
    workerId,
    salaryPeriod,
    amount: numericAmount,
    paymentMethod,
    remarks: String(remarks || "").trim(),
  };

  if (
    salaryAmount !== undefined &&
    salaryAmount !== null &&
    salaryAmount !== ""
  ) {
    payload.salaryAmount = validatePositiveAmount(
      salaryAmount,
      "The agreed monthly salary must be greater than zero.",
    );
  }

  if (date) payload.date = date;

  const response = await apiClient.post("/expenses/payroll/payment", payload);

  return getResponseData(response);
};

// ============================================================
// PAYROLL: RECORD BULK SALARY PAYMENTS
// POST /api/expenses/payroll/bulk
//
// Supports either:
// payments: [{ workerId, amount, salaryAmount? }]
// or legacy workers: [{ workerId, amount, salaryAmount? }]
// ============================================================

export const createBulkSalaryPayments = async ({
  salaryPeriod,
  payments,
  workers,
  paymentMethod,
  date,
  remarks = "",
}) => {
  validateSalaryPeriod(salaryPeriod);
  validatePaymentMethod(paymentMethod);

  const selectedPayments = Array.isArray(payments) ? payments : workers;

  if (!Array.isArray(selectedPayments) || selectedPayments.length === 0) {
    throw new Error("Select at least one worker for payroll.");
  }

  const normalizedPayments = selectedPayments.map((item) => {
    const workerId = item?.workerId || item?._id || item?.id;

    const amount = validatePositiveAmount(
      item?.amount,
      "Every selected worker must have a payment amount greater than zero.",
    );

    const payment = { workerId, amount };

    if (
      item?.salaryAmount !== undefined &&
      item?.salaryAmount !== null &&
      item?.salaryAmount !== ""
    ) {
      payment.salaryAmount = validatePositiveAmount(
        item.salaryAmount,
        "Any supplied agreed salary must be greater than zero.",
      );
    }

    if (!workerId) {
      throw new Error("Every selected worker must have a valid worker ID.");
    }

    return payment;
  });

  const payload = {
    salaryPeriod,
    payments: normalizedPayments,
    paymentMethod,
    remarks: String(remarks || "").trim(),
  };

  if (date) payload.date = date;

  const response = await apiClient.post("/expenses/payroll/bulk", payload);

  return getResponseData(response);
};
