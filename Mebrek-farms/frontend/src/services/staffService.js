import apiClient from "./apiClient";

// ============================================================
// GET ALL STAFF ACCOUNTS
// ============================================================

export const fetchStaff = async () => {
  const response = await apiClient.get("/auth/admins");

  return Array.isArray(response.data) ? response.data : [];
};

// ============================================================
// GET WORKERS FOR ACCOUNT LINKING
// ============================================================

export const fetchWorkers = async () => {
  const response = await apiClient.get("/workers");

  return Array.isArray(response.data) ? response.data : [];
};

// ============================================================
// CREATE STAFF ACCOUNT
// ============================================================

export const createStaff = async (data) => {
  const response = await apiClient.post("/auth/register", data);

  return response.data;
};

// ============================================================
// UPDATE ACCOUNT DETAILS
// ============================================================

export const updateStaff = async (id, data) => {
  const response = await apiClient.put(`/auth/admins/${id}`, data);

  return response.data;
};

// ============================================================
// DELETE ACCOUNT
// ============================================================

export const deleteStaff = async (id) => {
  const response = await apiClient.delete(`/auth/admins/${id}`);

  return response.data;
};

// ============================================================
// UPDATE ROLE
// ============================================================

export const updateRole = async (id, role) => {
  const response = await apiClient.put(`/auth/admins/${id}/role`, {
    role,
  });

  return response.data;
};

// ============================================================
// TOGGLE ACCOUNT STATUS
// ============================================================

export const toggleStatus = async (id) => {
  const response = await apiClient.put(`/auth/admins/${id}/status`);

  return response.data;
};

// ============================================================
// RESET PASSWORD
// ============================================================

export const resetPassword = async (id, password) => {
  const response = await apiClient.put(`/auth/admins/${id}/password`, {
    password,
  });

  return response.data;
};
