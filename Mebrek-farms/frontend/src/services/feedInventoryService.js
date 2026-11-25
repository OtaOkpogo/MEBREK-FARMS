
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

// GET FEEDS
export const fetchFeeds = async () => {
  const res = await axios.get(API_URL, getConfig());
  return res.data;
};

// CREATE FEED
export const createFeed = async (feedData) => {
  const res = await axios.post(
    API_URL,
    feedData,
    getConfig()
  );

  return res.data;
};

// UPDATE FEED DETAILS
export const updateFeed = async (id, feedData) => {
  const res = await axios.put(
    `${API_URL}/${id}`,
    feedData,
    getConfig()
  );

  return res.data;
};

// DELETE FEED
export const deleteFeed = async (id) => {
  const res = await axios.delete(
    `${API_URL}/${id}`,
    getConfig()
  );

  return res.data;
};

// ADJUST FEED STOCK
export const adjustFeedStock = async (id, adjustmentData) => {
  const res = await axios.patch(
    `${API_URL}/${id}/adjust-stock`,
    adjustmentData,
    getConfig()
  );

  return res.data;
};

