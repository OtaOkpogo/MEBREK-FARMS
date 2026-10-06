import apiClient from "./apiClient";

/*
|--------------------------------------------------------------------------
| GET ALL FLOCKS
|--------------------------------------------------------------------------
*/

export const fetchFlocks = async (params = {}) => {
  const response = await apiClient.get("/flocks", {
    params,
  });

  return response.data;
};

/*
|--------------------------------------------------------------------------
| GET SINGLE FLOCK
|--------------------------------------------------------------------------
*/

export const fetchFlock = async (id) => {
  const response = await apiClient.get(`/flocks/${id}`);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| GET ACTIVE FLOCK BY PEN
|--------------------------------------------------------------------------
*/

export const fetchActiveFlockByPen = async (pen) => {
  if (!pen) {
    return null;
  }

  try {
    const encodedPen = encodeURIComponent(pen);

    const response = await apiClient.get(`/flocks/pen/${encodedPen}/active`);

    return response.data.flock;
  } catch (error) {
    // No active flock in this pen is a normal condition.
    if (error.response?.status === 404) {
      return null;
    }

    console.error("FETCH ACTIVE FLOCK BY PEN ERROR:", error);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| CREATE FLOCK
|--------------------------------------------------------------------------
*/

export const createFlock = async (flockData) => {
  try {
    const response = await apiClient.post("/flocks", flockData);

    return response.data;
  } catch (error) {
    console.error("CREATE FLOCK API ERROR:", error.response?.data || error);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE FLOCK
|--------------------------------------------------------------------------
*/

export const updateFlock = async (id, flockData) => {
  try {
    const response = await apiClient.put(`/flocks/${id}`, flockData);

    return response.data;
  } catch (error) {
    console.error("UPDATE FLOCK API ERROR:", error.response?.data || error);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| SELL FLOCK
|--------------------------------------------------------------------------
*/

export const sellFlock = async (id, saleDate) => {
  const response = await apiClient.patch(`/flocks/${id}/sell`, {
    saleDate,
  });

  return response.data;
};

/*
|--------------------------------------------------------------------------
| DELETE FLOCK
|--------------------------------------------------------------------------
*/

export const deleteFlock = async (id) => {
  const response = await apiClient.delete(`/flocks/${id}`);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| RESTORE FLOCK
|--------------------------------------------------------------------------
*/

export const restoreFlock = async (id) => {
  const response = await apiClient.patch(`/flocks/${id}/restore`);

  return response.data;
};
