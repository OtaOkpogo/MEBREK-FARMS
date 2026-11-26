import axios from "axios";

const API_URL = "http://localhost:5000/api/feeds";

const getConfig = () => {
  const token = localStorage.getItem("token");

  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// ============================================================
// FETCH FEED INVENTORY
// ============================================================

export const fetchFeeds = async () => {
  const res = await axios.get(API_URL, getConfig());
  return res.data;
};

// ============================================================
// CREATE FEED RECORD
// SUPERADMIN + MANAGER
// ============================================================

export const createFeed = async (feedData) => {
  const res = await axios.post(API_URL, feedData, getConfig());
  return res.data;
};

// ============================================================
// UPDATE FEED DETAILS
// SUPERADMIN ONLY
// ============================================================

export const updateFeed = async (id, feedData) => {
  const res = await axios.put(`${API_URL}/${id}`, feedData, getConfig());

  return res.data;
};

// ============================================================
// DELETE FEED RECORD
// SUPERADMIN ONLY
// ============================================================

export const deleteFeed = async (id) => {
  const res = await axios.delete(`${API_URL}/${id}`, getConfig());

  return res.data;
};

// ============================================================
// DIRECT STOCK ADJUSTMENT
// SUPERADMIN ONLY
// ============================================================

export const adjustFeedStock = async (id, adjustmentData) => {
  const res = await axios.patch(
    `${API_URL}/${id}/adjust-stock`,
    adjustmentData,
    getConfig(),
  );

  return res.data;
};

// ============================================================
// SUBMIT FEED CHANGE REQUEST
// MANAGER
//
// Supports:
// 1. DETAILS_UPDATE
// 2. STOCK_ADJUSTMENT
//
// Stock adjustment supports both:
// direction: "add"
// direction: "remove"
// ============================================================

export const submitFeedChangeRequest = async (id, requestData) => {
  const res = await axios.post(
    `${API_URL}/${id}/change-requests`,
    requestData,
    getConfig(),
  );

  return res.data;
};

// ============================================================
// FETCH FEED CHANGE REQUESTS
// SUPERADMIN: All requests
// MANAGER: Own requests
// ============================================================

export const fetchFeedChangeRequests = async () => {
  const res = await axios.get(`${API_URL}/change-requests`, getConfig());

  return res.data;
};

// ============================================================
// APPROVE OR REJECT FEED CHANGE REQUEST
// SUPERADMIN ONLY
// ============================================================

export const reviewFeedChangeRequest = async (requestId, reviewData) => {
  const res = await axios.patch(
    `${API_URL}/change-requests/${requestId}`,
    reviewData,
    getConfig(),
  );

  return res.data;
};
