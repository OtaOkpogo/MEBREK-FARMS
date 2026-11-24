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
| GET ALL ACTIVE FLOCKS IN A PEN
|--------------------------------------------------------------------------
*/

export const fetchActiveFlocksByPen = async (pen) => {
  if (!pen) return [];

  const encodedPen = encodeURIComponent(pen);

  const response = await apiClient.get(`/flocks/pen/${encodedPen}/active`);

  return response.data.allocations || [];
};

/*
|--------------------------------------------------------------------------
| LEGACY: GET ONE ACTIVE FLOCK BY PEN
|--------------------------------------------------------------------------
| Retained temporarily for older components.
| If multiple flocks occupy the pen, this returns the first one.
|--------------------------------------------------------------------------
*/

export const fetchActiveFlockByPen = async (pen) => {
  if (!pen) return null;

  const allocations = await fetchActiveFlocksByPen(pen);

  return allocations.length ? allocations[0].flock : null;
};

/*
|--------------------------------------------------------------------------
| CREATE FLOCK
|--------------------------------------------------------------------------
*/

export const createFlock = async (data) => {
  const response = await apiClient.post("/flocks", data);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| UPDATE FLOCK
|--------------------------------------------------------------------------
*/

export const updateFlock = async (id, data) => {
  const response = await apiClient.put(`/flocks/${id}`, data);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| GET FLOCK ALLOCATIONS
|--------------------------------------------------------------------------
*/

export const fetchFlockAllocations = async (id) => {
  const response = await apiClient.get(`/flocks/${id}/allocations`);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| GET FLOCK TRANSFERS
|--------------------------------------------------------------------------
*/

export const fetchFlockTransfers = async (id) => {
  const response = await apiClient.get(`/flocks/${id}/transfers`);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| CREATE FLOCK TRANSFER
|--------------------------------------------------------------------------
*/

export const createFlockTransfer = async (id, data) => {
  const response = await apiClient.post(`/flocks/${id}/transfers`, data);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| GET FLOCK POPULATION HISTORY
|--------------------------------------------------------------------------
*/

export const fetchFlockPopulationHistory = async (id) => {
  const response = await apiClient.get(`/flocks/${id}/population-history`);

  return response.data;
};

/*
|--------------------------------------------------------------------------
| ADJUST FLOCK POPULATION
|--------------------------------------------------------------------------
*/

export const createFlockPopulationAdjustment = async (id, data) => {
  const response = await apiClient.post(
    `/flocks/${id}/population-adjustments`,
    data,
  );

  return response.data;
};

/*
|--------------------------------------------------------------------------
| SELL FLOCK / RECORD BIRD SALE
|--------------------------------------------------------------------------
*/

export const sellFlock = async (id, saleDate, allocationSales) => {
  const payload = {};

  if (saleDate) {
    payload.saleDate = saleDate;
  }

  if (allocationSales) {
    payload.allocationSales = allocationSales;
  }

  const response = await apiClient.patch(`/flocks/${id}/sell`, payload);

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
