import apiClient from "./apiClient";

// ============================================================
// WORKER CRUD
// ============================================================

export const fetchWorkers = async () => {
  const res = await apiClient.get("/workers");

  return res?.workers || res?.data?.workers || res?.data || res || [];
};

export const fetchWorkerById = async (id) => {
  return apiClient.get(`/workers/${id}`);
};

export const createWorker = async (data) => {
  return apiClient.post("/workers", data);
};

export const updateWorker = async (id, data) => {
  return apiClient.put(`/workers/${id}`, data);
};

export const deleteWorker = async (id) => {
  return apiClient.delete(`/workers/${id}`);
};

// ============================================================
// WORKER STATISTICS
// ============================================================

export const fetchWorkerStats = async () => {
  return apiClient.get("/workers/stats");
};

export const fetchAdvancedWorkerAnalytics = async () => {
  return apiClient.get("/workers/analytics/summary");
};

// ============================================================
// WORKER SEARCH
// ============================================================

export const searchWorkers = async (search) => {
  const term = String(search || "").trim();

  if (!term) {
    return fetchWorkers();
  }

  const res = await apiClient.get("/workers/search", {
    params: { search: term },
  });

  return res?.workers || res?.data?.workers || res?.data || res || [];
};

// ============================================================
// ATTENDANCE AND PUNCTUALITY
// ============================================================

export const fetchWorkerAttendanceSummary = async (workerId, filters = {}) => {
  if (!workerId) {
    throw new Error("A worker ID is required.");
  }

  return apiClient.get(`/workers/${workerId}/attendance-summary`, {
    params: {
      ...(filters.startDate ? { startDate: filters.startDate } : {}),
      ...(filters.endDate ? { endDate: filters.endDate } : {}),
    },
  });
};

// ============================================================
// PERFORMANCE REVIEWS
// ============================================================

export const fetchPerformanceReviews = async (workerId) => {
  if (!workerId) {
    throw new Error("A worker ID is required.");
  }

  return apiClient.get(`/workers/${workerId}/reviews`);
};

export const createPerformanceReview = async (workerId, reviewData) => {
  if (!workerId) {
    throw new Error("A worker ID is required.");
  }

  return apiClient.post(`/workers/${workerId}/reviews`, reviewData);
};

export const updatePerformanceReview = async (
  workerId,
  reviewId,
  reviewData,
) => {
  if (!workerId || !reviewId) {
    throw new Error("Worker ID and review ID are required.");
  }

  return apiClient.put(`/workers/${workerId}/reviews/${reviewId}`, reviewData);
};

export const deletePerformanceReview = async (workerId, reviewId) => {
  if (!workerId || !reviewId) {
    throw new Error("Worker ID and review ID are required.");
  }

  return apiClient.delete(`/workers/${workerId}/reviews/${reviewId}`);
};

// ============================================================
// EMPLOYMENT HISTORY
// ============================================================

export const fetchEmploymentHistory = async (workerId) => {
  if (!workerId) {
    throw new Error("A worker ID is required.");
  }

  return apiClient.get(`/workers/${workerId}/employment-history`);
};
