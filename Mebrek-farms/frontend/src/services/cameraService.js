import apiClient from "./apiClient";

// =========================================
// GET ALL CAMERAS
// =========================================
export const fetchCameras = async () => {
  const response = await apiClient.get("/cameras");
  return response.data;
};

// =========================================
// CREATE CAMERA
// =========================================
export const createCamera = async (cameraData) => {
  const response = await apiClient.post("/cameras", cameraData);
  return response.data;
};

// =========================================
// UPDATE CAMERA
// =========================================
export const updateCamera = async (id, cameraData) => {
  const response = await apiClient.put(`/cameras/${id}`, cameraData);
  return response.data;
};

// =========================================
// DISABLE CAMERA
// =========================================
export const disableCamera = async (id) => {
  const response = await apiClient.patch(`/cameras/${id}/disable`);
  return response.data;
};

// =========================================
// ENABLE CAMERA
// =========================================
export const enableCamera = async (id) => {
  const response = await apiClient.patch(`/cameras/${id}/enable`);
  return response.data;
};

// =========================================
// DELETE CAMERA
// =========================================
export const deleteCamera = async (id) => {
  const response = await apiClient.delete(`/cameras/${id}`);
  return response.data;
};
