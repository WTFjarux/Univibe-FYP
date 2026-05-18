// lib/services/profileService.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import { profileCache } from "../cache/profileCache";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const getBaseUrl = (): string => {
  if (!API_BASE_URL) {
    console.warn("API_BASE_URL is not defined, using fallback");
    return "http://localhost:5001";
  }
  return API_BASE_URL;
};

const BASE_URL = getBaseUrl();

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

const getToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    return token || null;
  } catch (error) {
    console.error("Error getting token:", error);
    return null;
  }
};

const getHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const getFormDataHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();
  return {
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const getMimeType = (filename: string): string => {
  const extension = filename.toLowerCase();
  if (extension.endsWith(".png")) return "image/png";
  if (extension.endsWith(".gif")) return "image/gif";
  if (extension.endsWith(".webp")) return "image/webp";
  if (extension.endsWith(".heic")) return "image/heic";
  if (extension.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
};

const createImageFormData = (imageUri: string, fieldName: string): FormData => {
  const filename = imageUri.split("/").pop() || `${fieldName}.jpg`;
  const mimeType = getMimeType(filename);

  const formData = new FormData();
  formData.append(fieldName, {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);

  return formData;
};

// -----------------------------------------------------------------------------
// Auth Error Handler
// Silently clears tokens and cache. AuthContext is responsible for showing alerts.
// -----------------------------------------------------------------------------

const handleAuthError = async (data: any): Promise<boolean> => {
  if (!data) return false;

  if (data.code === "ACCOUNT_BANNED") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await profileCache.clearAll();
    return true;
  }

  if (data.code === "ACCOUNT_SUSPENDED") {
    return true;
  }

  if (data.code === "TOKEN_VERSION_MISMATCH") {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await profileCache.clearAll();
    return true;
  }

  return false;
};

// -----------------------------------------------------------------------------
// HTTP Helpers
// -----------------------------------------------------------------------------

const authFetch = async (
  url: string,
  options: RequestInit = {},
): Promise<Response> => {
  const headers = await getHeaders();
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (response.status === 401) {
    await SecureStore.deleteItemAsync("authToken");
    await profileCache.clearAll();
    throw new Error("Session expired. Please login again.");
  }

  return response;
};

const handleResponse = async (response: Response): Promise<any> => {
  const data = await response.json();

  if (!response.ok) {
    // Handle auth errors first (ban, suspension, force logout)
    const authHandled = await handleAuthError(data);
    if (authHandled) {
      return null;
    }

    // Handle block-related errors
    if (response.status === 403) {
      const error = new Error(data.message || "Access denied");
      (error as any).isBlocked = data.isBlocked;
      (error as any).isBlockedByOwner = data.isBlockedByOwner;
      (error as any).isMutual = data.isMutual;
      (error as any).status = response.status;
      throw error;
    }

    if (response.status === 401) {
      const error = new Error(data.message || "Session expired");
      (error as any).status = response.status;
      throw error;
    }

    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
};

const getCacheKey = (prefix: string, identifier?: string): string => {
  return identifier ? `${prefix}_${identifier}` : prefix;
};

// -----------------------------------------------------------------------------
// Profile Service
// -----------------------------------------------------------------------------

export const profileService = {
  // ---------------------------------------------------------------------------
  // Profile Setup & Basic Operations
  // ---------------------------------------------------------------------------

  setupProfile: async (profileData: any) => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/setup`, {
        method: "POST",
        body: JSON.stringify(profileData),
      });
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Setup profile error:", error);
      throw error;
    }
  },

  checkProfileStatus: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/status`, {
        method: "GET",
      });
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Check profile status error:", error);
      throw error;
    }
  },

  getProfileDetails: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/details`, {
        method: "GET",
      });
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get profile details error:", error);
      throw error;
    }
  },

  getMyProfile: async (forceRefresh: boolean = false) => {
    try {
      const token = await getToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const cacheKey = "my_profile";

      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }

      const response = await fetch(`${BASE_URL}/api/profile/my-profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Error getting my profile:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Network error",
      };
    }
  },

  updateProfile: async (profileData: any) => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/update`, {
        method: "PUT",
        body: JSON.stringify(profileData),
      });
      const result = await handleResponse(response);

      if (result === null) return null;

      if (result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Profile Picture Operations
  // ---------------------------------------------------------------------------

  uploadProfilePicture: async (imageUri: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const formData = createImageFormData(imageUri, "profilePicture");
      const response = await fetch(`${BASE_URL}/api/profile/upload-picture`, {
        method: "POST",
        headers: await getFormDataHeaders(),
        body: formData,
      });
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Upload profile picture error:", error);
      throw error;
    }
  },

  deleteProfilePicture: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/picture`, {
        method: "DELETE",
      });
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Delete profile picture error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Cover Photo Operations
  // ---------------------------------------------------------------------------

  uploadCoverPhoto: async (imageUri: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token");
      }

      const formData = createImageFormData(imageUri, "coverPhoto");
      const response = await fetch(
        `${BASE_URL}/api/profile/upload-cover-photo`,
        {
          method: "POST",
          headers: await getFormDataHeaders(),
          body: formData,
        },
      );
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Upload cover photo error:", error);
      throw error;
    }
  },

  deleteCoverPhoto: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/cover-photo`, {
        method: "DELETE",
      });
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.invalidateUserProfile();
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Delete cover photo error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Public Profile Operations (with caching)
  // ---------------------------------------------------------------------------

  getPublicProfile: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey("public_profile", userId);

      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) {
          if (cached.isBlocked || cached.isBlockedByOwner) return cached;
          return { ...cached, _cached: true };
        }

        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) {
          if (stored.isBlocked || stored.isBlockedByOwner) return stored;
          return { ...stored, _cached: true };
        }
      }

      const token = await getToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${BASE_URL}/api/profile/public/${userId}`, {
        method: "GET",
        headers,
      });

      const data = await response.json();

      if (response.status === 403) {
        const blockResult = {
          success: false,
          isBlocked: data.isBlocked,
          isBlockedByOwner: data.isBlockedByOwner,
          message: data.message,
          status: response.status,
        };
        await profileCache.saveToStorage(cacheKey, blockResult);
        return blockResult;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            `Request failed with status ${response.status}`,
        );
      }

      const result = { success: true, ...data };

      if (result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error("Error fetching public profile:", error);
      throw error;
    }
  },

  getProfileByUsername: async (
    username: string,
    forceRefresh: boolean = false,
  ) => {
    try {
      const cacheKey = getCacheKey("profile_username", username);

      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }

      const response = await authFetch(
        `${BASE_URL}/api/profile/username/${encodeURIComponent(username)}`,
        { method: "GET" },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get profile by username error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Search & List Operations
  // ---------------------------------------------------------------------------

  getAllProfiles: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/profile/all?page=${page}&limit=${limit}`,
        {
          method: "GET",
        },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get all profiles error:", error);
      throw error;
    }
  },

  searchProfiles: async (
    query: string,
    page: number = 1,
    limit: number = 20,
  ) => {
    try {
      if (!query.trim()) {
        return {
          success: false,
          profiles: [],
          pagination: { page: 1, limit, total: 0, pages: 0 },
        };
      }

      const response = await authFetch(
        `${BASE_URL}/api/profile/search?query=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`,
        { method: "GET" },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Search profiles error:", error);
      throw error;
    }
  },

  searchConnections: async (query: string, limit: number = 20) => {
    try {
      if (!query.trim()) return { success: true, data: [] };

      const response = await authFetch(
        `${BASE_URL}/api/profile/search-connections?query=${encodeURIComponent(query.trim())}&limit=${limit}`,
        { method: "GET" },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Search connections error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Profile Content
  // ---------------------------------------------------------------------------

  getUserPosts: async (
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/posts/user/${userId}?page=${page}&limit=${limit}`,
        { method: "GET" },
      );

      const data = await response.json();

      if (response.status === 403 && data.viewerStatus?.isBlocked) {
        return {
          success: true,
          data: {
            posts: [],
            pagination: { page, limit, total: 0, pages: 0 },
            viewerStatus: data.viewerStatus,
          },
        };
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch posts");
      }

      return data;
    } catch (error) {
      console.error("Get user posts error:", error);
      throw error;
    }
  },

  getUserStats: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey("user_stats", userId);

      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }

      const response = await authFetch(
        `${BASE_URL}/api/profile/${userId}/stats`,
        {
          method: "GET",
        },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get user stats error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Connection Recommendations
  // ---------------------------------------------------------------------------

  getRecommendedProfiles: async (limit: number = 10) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/profile/recommendations?limit=${limit}`,
        {
          method: "GET",
        },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get recommended profiles error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // User Moderation
  // ---------------------------------------------------------------------------

  toggleBlockUser: async (userId: string, reason?: string) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/content/block/${userId}`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reason || null }),
        },
      );
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.clear(`public_profile_${userId}`);
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Toggle block user error:", error);
      throw error;
    }
  },

  getBlockedUsers: async (
    page: number = 1,
    limit: number = 20,
    type: "all" | "blocked_by_me" | "blocked_me" = "all",
  ) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/content/blocked?page=${page}&limit=${limit}&type=${type}`,
        { method: "GET" },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get blocked users error:", error);
      throw error;
    }
  },

  getMutedUsers: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/content/muted?page=${page}&limit=${limit}`,
        {
          method: "GET",
        },
      );
      return await handleResponse(response);
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Get muted users error:", error);
      throw error;
    }
  },

  toggleMuteUser: async (userId: string) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/content/mute/${userId}`,
        {
          method: "POST",
        },
      );
      const result = await handleResponse(response);

      if (result && result.success) {
        await profileCache.clear(`public_profile_${userId}`);
      }

      return result;
    } catch (error: any) {
      if (error.isAuthError) throw error;
      console.error("Toggle mute user error:", error);
      throw error;
    }
  },

  reportUser: async (
    userId: string,
    reason: string,
    description?: string,
  ): Promise<{ success: boolean; message?: string; reportId?: string }> => {
    try {
      const token = await getToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const response = await fetch(`${BASE_URL}/api/profile/report/${userId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, description: description || "" }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Report user error:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to report user",
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Batch Operations
  // ---------------------------------------------------------------------------

  getProfileBatch: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey("profile_batch", userId);

      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };

        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }

      const token = await getToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }

      const [profile, posts, stats] = await Promise.all([
        profileService.getPublicProfile(userId, forceRefresh),
        profileService.getUserPosts(userId, 1, 5),
        profileService.getUserStats(userId, forceRefresh),
      ]);

      const result = {
        success: true,
        profile: profile.profile,
        user: profile.user,
        connectionStatus: profile.connectionStatus,
        recentPosts: posts.posts || [],
        stats: stats,
        isOwnProfile: profile.isOwnProfile || false,
      };

      await profileCache.saveToStorage(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Batch profile fetch error:", error);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  getFullImageUrl: (url: string | null | undefined): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    const baseUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl}${cleanUrl}`;
  },

  clearCache: async () => {
    await profileCache.clearAll();
  },

  prefetchProfile: async (userId: string): Promise<void> => {
    try {
      await profileService.getProfileBatch(userId, false);
    } catch (error) {
      console.error("Prefetch error:", error);
    }
  },
};

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export interface Profile {
  _id: string;
  user: string | User;
  fullName: string;
  bio?: string;
  major?: string;
  year?: string;
  campus: string;
  profilePicture?: string;
  coverPhoto?: string;
  location?: string;
  website?: string;
  interests?: string[];
  skills?: string[];
  isProfileComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  verified: boolean;
  connections?: string[];
}

export interface PublicProfileResponse {
  success: boolean;
  profile?: Profile;
  user?: User;
  isOwnProfile?: boolean;
  isBlocked?: boolean;
  isBlockedByOwner?: boolean;
  message?: string;
}

export interface BlockedUserData {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email: string;
    fullName?: string;
    profilePicture?: string;
  };
  direction: "one_way" | "mutual";
  blockedByMe: boolean;
  isMutual: boolean;
  blockedAt: string;
  reason?: string;
}

export interface BlockedUsersResponse {
  success: boolean;
  data: {
    users: BlockedUserData[];
    stats: {
      total: number;
      blockedByMe: number;
      blockedMe: number;
      mutual: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface SearchProfilesResponse {
  success: boolean;
  profiles: Array<{
    user: User;
    profile: Profile;
    connectionStatus: "connected" | "pending" | "not_connected";
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface BatchProfileResponse {
  success: boolean;
  profile?: Profile;
  user?: User;
  connectionStatus?: {
    isConnected: boolean;
    isPending?: boolean;
    isBlocked?: boolean;
  };
  recentPosts?: any[];
  stats?: any;
  isOwnProfile?: boolean;
  _cached?: boolean;
  message?: string;
}

export const {
  setupProfile,
  checkProfileStatus,
  getProfileDetails,
  getMyProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  uploadCoverPhoto,
  deleteCoverPhoto,
  getPublicProfile,
  getProfileByUsername,
  getAllProfiles,
  searchProfiles,
  searchConnections,
  getUserPosts,
  getUserStats,
  getRecommendedProfiles,
  toggleBlockUser,
  getBlockedUsers,
  getMutedUsers,
  toggleMuteUser,
  reportUser,
  getFullImageUrl,
  clearCache,
  getProfileBatch,
  prefetchProfile,
} = profileService;

export { profileCache };
