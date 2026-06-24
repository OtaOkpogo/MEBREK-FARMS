import apiClient from "./apiClient";

export const fetchStaff = async () => {
  const res = await apiClient.get(
    "/staff"
  );

  return res?.data || [];
};

export const createStaff = async (
  data
) => {
  return await apiClient.post(
    "/staff",
    data
  );
};

export const updateStaff = async (
  id,
  data
) => {
  return await apiClient.put(
    `/staff/${id}`,
    data
  );
};

export const deleteStaff = async (
  id
) => {
  return await apiClient.delete(
    `/staff/${id}`
  );
};
