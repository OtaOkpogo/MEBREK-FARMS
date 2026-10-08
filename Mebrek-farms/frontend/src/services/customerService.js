import apiClient from "./apiClient";

// ============================================================
// CUSTOMER SERVICE
// ============================================================

export const fetchCustomers = async () => {
  return await apiClient.get("/customers");
};

export const searchCustomers = async (search) => {
  return await apiClient.get("/customers/search", {
    params: {
      search,
    },
  });
};

export const fetchCustomerById = async (id) => {
  return await apiClient.get(`/customers/${id}`);
};

export const createCustomer = async (customerData) => {
  return await apiClient.post("/customers", customerData);
};

export const updateCustomer = async (id, customerData) => {
  return await apiClient.put(`/customers/${id}`, customerData);
};

export const deleteCustomer = async (id) => {
  return await apiClient.delete(`/customers/${id}`);
};
