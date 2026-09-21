import apiClient from "./apiClient";

// Get the currently active flock occupying a pen.
export const fetchActiveFlockByPen = async (pen) => {
  if (!pen) {
    return null;
  }

  try {
    const encodedPen = encodeURIComponent(pen);

    const response = await apiClient.get(
      `/flocks/pen/${encodedPen}/active`,
    );

    return response;
  } catch (error) {
    // 404 simply means the pen currently has no active flock.
    if (error.response?.status === 404) {
      return null;
    }

    throw error;
  }
};
