// frontend/src/api/axios.js

import axios from "axios";
import useAuthStore from "../store/authStore";

/**
 * Admin API Axios Instance
 *
 * FEATURES:
 * - Automatic access token attachment
 * - Automatic token refresh on 401
 * - Request queue during refresh
 * - Redirect to login on auth failure
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000, // 15 second timeout
});

// ============================================
// TOKEN REFRESH LOGIC
// ============================================

let isRefreshing = false;
let failedQueue = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Attempt to refresh the access token
 */
const refreshAccessToken = async () => {
  const { refreshToken } = useAuthStore.getState();

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await axios.post(
    `${api.defaults.baseURL}/api/admin/auth/refresh`,
    { refreshToken },
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return response.data.data;
};

// ============================================
// REQUEST INTERCEPTOR
// ============================================

api.interceptors.request.use(
  (config) => {
    // Get current access token from store
    const { accessToken } = useAuthStore.getState();

    // Attach access token to request
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add request ID for tracking
    config.headers["X-Request-ID"] = generateRequestId();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const { logout } = useAuthStore.getState();

    // Don't retry login requests or refresh requests
    if (
      originalRequest.url === "/api/admin/auth/login" ||
      originalRequest.url === "/api/admin/auth/refresh"
    ) {
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Token expired or invalid
      const errorCode = error.response?.data?.code;

      // Only attempt refresh for expired tokens
      if (errorCode === "TOKEN_EXPIRED" && !originalRequest._retry) {
        if (isRefreshing) {
          // Queue request while refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const {
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn,
          } = await refreshAccessToken();

          // Update tokens in store
          useAuthStore.getState().setAccessToken(accessToken, expiresIn);
          useAuthStore.getState().setRefreshing(false);

          // Process queued requests
          processQueue(null, accessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear queue and logout
          processQueue(refreshError, null);
          isRefreshing = false;
          useAuthStore.getState().setRefreshing(false);

          // Logout and redirect to login
          logout();

          // Redirect to login page
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }

          return Promise.reject(refreshError);
        }
      }

      // For non-expired token errors, logout immediately
      if (
        errorCode === "TOKEN_VERSION_MISMATCH" ||
        errorCode === "ACCOUNT_BANNED" ||
        errorCode === "ACCOUNT_SUSPENDED"
      ) {
        logout();

        // Show appropriate message before redirect
        const messages = {
          TOKEN_VERSION_MISMATCH:
            "Your session has been invalidated. Please login again.",
          ACCOUNT_BANNED: "Your account has been banned.",
          ACCOUNT_SUSPENDED: "Your account has been suspended.",
        };

        alert(messages[errorCode] || "Session expired. Please login again.");

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.code;

      if (errorCode === "PERMISSION_DENIED") {
        console.error("Permission denied:", error.response?.data?.required);
        // Could redirect to a "not authorized" page
      }
    }

    return Promise.reject(error);
  },
);

// ============================================
// HELPERS
// ============================================

/**
 * Generate a unique request ID for tracking
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export default api;
