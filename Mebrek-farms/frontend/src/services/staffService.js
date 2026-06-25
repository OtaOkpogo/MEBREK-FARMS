import apiClient from "./apiClient";

// ================= GET ALL STAFF =================

export const fetchStaff = async () => {
  return await apiClient.get("/auth/admins");
};

// ================= CREATE STAFF =================

export const createStaff = async (data) => {
  return await apiClient.post("/auth/register", data);
};

// ================= UPDATE STAFF =================

export const updateStaff = async (id, data) => {
  return await apiClient.put(`/staff/${id}`, data);
};

// ================= DELETE STAFF =================

export const deleteStaff = async (id) => {
  return await apiClient.delete(`/auth/admins/${id}`);
};

// ================= UPDATE ROLE =================

export const updateRole = async (id, role) => {
  return await apiClient.put(`/auth/admins/${id}/role`, {
    role,
  });
};

// ================= TOGGLE STATUS =================

export const toggleStatus = async (id) => {
  return await apiClient.put(`/auth/admins/${id}/status`);
};

// ================= RESET PASSWORD =================

export const resetPassword = async (id, password) => {
  return await apiClient.put(`/auth/admins/${id}/password`, {
    password,
  });
};
