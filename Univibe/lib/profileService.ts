// app/lib/profileService.ts
/**
 * Profile Service - Handles all profile-related API operations
 * Note: Connection-related operations are handled by connectionService.ts
 */

import * as SecureStore from 'expo-secure-store'; 
import { API_BASE_URL } from '../constants/ipConstants'; 

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get authentication token from secure storage
 */
const getToken = async (): Promise<string | null> => {
  try {
    const token = await SecureStore.getItemAsync('authToken');
    return token || null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

/**
 * Get JSON request headers with authentication
 * Returns undefined if no token (fetch will use default headers)
 */
const getHeaders = async (): Promise<HeadersInit | undefined> => {
  const token = await getToken();
  if (!token) {
    return undefined;
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Get FormData headers for file uploads
 * Returns undefined if no token
 */
const getFormDataHeaders = async (): Promise<HeadersInit | undefined> => {
  const token = await getToken();
  if (!token) {
    return undefined;
  }
  return {
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Determine MIME type from filename extension
 */
const getMimeType = (filename: string): string => {
  const extension = filename.toLowerCase();
  if (extension.endsWith('.png')) return 'image/png';
  if (extension.endsWith('.gif')) return 'image/gif';
  if (extension.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

/**
 * Create FormData object for image upload
 */
const createImageFormData = (imageUri: string, fieldName: string): FormData => {
  const filename = imageUri.split('/').pop() || `${fieldName}.jpg`;
  const mimeType = getMimeType(filename);
  
  const formData = new FormData();
  formData.append(fieldName, {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as any);
  
  return formData;
};

/**
 * Helper to make authenticated fetch requests
 */
const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = await getHeaders();
  return fetch(url, {
    ...options,
    headers: headers || options.headers,
  });
};

// ============================================
// PROFILE SERVICE
// ============================================

export const profileService = {
  // ============================================
  // PROFILE SETUP & BASIC OPERATIONS
  // ============================================

  /**
   * Complete initial profile setup for new users
   */
  setupProfile: async (profileData: any) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/setup`, {
        method: 'POST',
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Check if user has completed their profile setup
   */
  checkProfileStatus: async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/status`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get authenticated user's detailed profile information
   */
  getProfileDetails: async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/details`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get authenticated user's full profile with timestamps
   */
  getMyProfile: async () => {
    try {
      const token = await getToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profile/my-profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting my profile:', error);
      return { success: false, message: "Network error" };
    }
  },

  /**
   * Update profile information
   */
  updateProfile: async (profileData: any) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // PROFILE PICTURE OPERATIONS
  // ============================================

  /**
   * Upload a new profile picture
   */
  uploadProfilePicture: async (imageUri: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const formData = createImageFormData(imageUri, 'profilePicture');
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete profile picture and reset to default avatar
   */
  deleteProfilePicture: async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/picture`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // COVER PHOTO OPERATIONS
  // ============================================

  /**
   * Upload a new cover photo
   */
  uploadCoverPhoto: async (imageUri: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token');
      }
      
      const formData = createImageFormData(imageUri, 'coverPhoto');
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-cover-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete cover photo
   */
  deleteCoverPhoto: async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/cover-photo`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // PUBLIC PROFILE OPERATIONS
  // ============================================

  /**
   * Get public profile by user ID
   */
  getPublicProfile: async (userId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
        method: 'GET',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        } : {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching public profile:', error);
      throw error;
    }
  },

  /**
   * Get public profile by username
   */
  getProfileByUsername: async (username: string) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/username/${encodeURIComponent(username)}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // SEARCH & LIST OPERATIONS
  // ============================================

  /**
   * Get all profiles with pagination
   */
  getAllProfiles: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/all?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Search profiles by name, username, major, or bio
   */
  searchProfiles: async (query: string, page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // PROFILE CONTENT
  // ============================================

  /**
   * Get user's posts for profile view
   */
  getUserPosts: async (userId: string, page: number = 1, limit: number = 10) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/${userId}/posts?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get user activity statistics
   */
  getUserStats: async (userId: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/${userId}/stats`, {
        method: 'GET',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // CONNECTION RECOMMENDATIONS
  // ============================================

  /**
   * Get recommended profiles based on mutual connections
   */
  getRecommendedProfiles: async (limit: number = 10) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/recommendations?limit=${limit}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================
  // USER MODERATION
  // ============================================

  /**
   * Block a user
   */
  blockUser: async (userId: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/block/${userId}`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Unblock a user
   */
  unblockUser: async (userId: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/unblock/${userId}`, {
        method: 'POST',
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get list of blocked users
   */
  getBlockedUsers: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${API_BASE_URL}/api/profile/blocked?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Report a user for inappropriate behavior
   */
  reportUser: async (userId: string, reason: string, details?: string) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/profile/report/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ reason, details })
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};