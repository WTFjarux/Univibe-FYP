// lib/services/contentService.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../../constants/ipConstants";
import { Post } from "./postService";

// ============================================
// INTERFACES
// ============================================

export interface SavePostResponse {
  success: boolean;
  saved: boolean;
  message: string;
}

export interface SavedPostsResponse {
  success: boolean;
  data?: {
    posts: Post[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface HidePostResponse {
  success: boolean;
  hidden: boolean;
  message: string;
}

export interface HiddenPostsResponse {
  success: boolean;
  data?: {
    posts: Post[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface MuteUserResponse {
  success: boolean;
  muted: boolean;
  message: string;
}

export interface MutedUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  fullName?: string;
  profilePicture?: string;
}

export interface MutedUsersResponse {
  success: boolean;
  data?: {
    users: MutedUser[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

export interface BlockUserResponse {
  success: boolean;
  blocked: boolean;
  message: string;
}

export interface BlockedUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  fullName?: string;
  profilePicture?: string;
}

export interface BlockedUsersResponse {
  success: boolean;
  data?: {
    users: BlockedUser[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  message?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
};

const buildApiUrl = (endpoint: string): string => {
  let baseUrl = API_BASE_URL;
  if (!baseUrl.endsWith("/")) {
    baseUrl += "/";
  }
  let cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  if (!baseUrl.includes("/api/") && !cleanEndpoint.startsWith("api/")) {
    cleanEndpoint = `api/${cleanEndpoint}`;
  }
  return `${baseUrl}${cleanEndpoint}`;
};

// ============================================
// SAVED POSTS
// ============================================

/**
 * Save or unsave a post
 */
export const toggleSavePost = async (
  postId: string,
): Promise<SavePostResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`content/save/${postId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save post");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling save post:", error);
    throw error;
  }
};

/**
 * Get all saved posts for the current user
 */
export const getSavedPosts = async (
  page: number = 1,
  limit: number = 20,
): Promise<SavedPostsResponse> => {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    const url = buildApiUrl(`content/saved?${params.toString()}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get saved posts: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting saved posts:", error);
    throw error;
  }
};

// ============================================
// HIDDEN POSTS
// ============================================

/**
 * Hide a post (remove from feed)
 */
export const hidePost = async (postId: string): Promise<HidePostResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`content/hide/${postId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to hide post");
    }

    return await response.json();
  } catch (error) {
    console.error("Error hiding post:", error);
    throw error;
  }
};

/**
 * Unhide a post
 */
export const unhidePost = async (postId: string): Promise<HidePostResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`content/unhide/${postId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to unhide post");
    }

    return await response.json();
  } catch (error) {
    console.error("Error unhiding post:", error);
    throw error;
  }
};

/**
 * Get all hidden posts for the current user
 */
export const getHiddenPosts = async (
  page: number = 1,
  limit: number = 20,
): Promise<HiddenPostsResponse> => {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    const url = buildApiUrl(`content/hidden?${params.toString()}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get hidden posts: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting hidden posts:", error);
    throw error;
  }
};

// ============================================
// MUTED USERS
// ============================================

/**
 * Mute or unmute a user
 */
export const toggleMuteUser = async (
  userId: string,
): Promise<MuteUserResponse> => {
  try {
    const token = await getAuthToken();
    const url = buildApiUrl(`content/mute/${userId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to mute user");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling mute user:", error);
    throw error;
  }
};

/**
 * Get all muted users for the current user
 */
export const getMutedUsers = async (
  page: number = 1,
  limit: number = 20,
): Promise<MutedUsersResponse> => {
  try {
    const token = await getAuthToken();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    const url = buildApiUrl(`content/muted?${params.toString()}`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get muted users: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting muted users:", error);
    throw error;
  }
};

// ============================================
// BLOCKED USERS
// ============================================

/**
 * Block or unblock a user
 */
export const toggleBlockUser = async (
  userId: string,
): Promise<{ success: boolean; blocked: boolean; message: string }> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");

    // Validate userId before sending
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      throw new Error("Invalid user ID");
    }

    const url = buildApiUrl(`content/block/${userId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to block user");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling block user:", error);
    throw error;
  }
};

/**
 * Get all blocked users for the current user
 */
export const getBlockedUsers = async (
  page: number = 1,
  limit: number = 20,
  type: "all" | "blocked_by_me" | "blocked_me" = "blocked_by_me",
): Promise<any> => {
  try {
    const token = await SecureStore.getItemAsync("authToken");
    const url = `${API_BASE_URL}/api/content/blocked?page=${page}&limit=${limit}&type=${type}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch blocked users");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    throw error;
  }
};
// ============================================
// BULK/CLEANUP OPERATIONS
// ============================================

/**
 * Clear all content management caches (useful on logout)
 */
export const clearContentCache = async (): Promise<void> => {
  // This would typically clear any local storage/cache for content management
  // Implement based on your caching strategy
  console.log("Content cache cleared");
};
