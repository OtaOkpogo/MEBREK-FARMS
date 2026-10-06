import axios from "axios";

// ============================================================
// API CLIENT
// ============================================================

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",

  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================
// REQUEST INTERCEPTOR
// ============================================================

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // --------------------------------------------------------
    // IMPORTANT:
    // When sending FormData, do NOT manually set
    // Content-Type to application/json.
    //
    // The browser/Axios will automatically set:
    //
    // multipart/form-data; boundary=...
    // --------------------------------------------------------

    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ============================================================
// RESPONSE INTERCEPTOR
// ============================================================

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API ERROR:", error);

    return Promise.reject(error);
  },
);

export default apiClient;
