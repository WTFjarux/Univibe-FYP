/**
 * Profile Service - Handles all profile-related API operations
 */

import * as SecureStore from 'expo-secure-store'; 
import { API_BASE_URL } from '../../constants/ipConstants';
import { profileCache } from '../cache/profileCache';

// ============================================
// ENSURE API_BASE_URL IS DEFINED
// ============================================

const getBaseUrl = (): string => {
  if (!API_BASE_URL) {
    console.warn('API_BASE_URL is not defined, using fallback');
    return 'http://localhost:5001';
  }
  return API_BASE_URL;
};

const BASE_URL = getBaseUrl();

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
 */
const getHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

/**
 * Get FormData headers for file uploads
 */
const getFormDataHeaders = async (): Promise<HeadersInit> => {
  const token = await getToken();
  return {
    ...(token && { 'Authorization': `Bearer ${token}` })
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
  if (extension.endsWith('.heic')) return 'image/heic';
  if (extension.endsWith('.heif')) return 'image/heif';
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
 * Helper to make authenticated fetch requests with error handling
 */
const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = await getHeaders();
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  
  // Handle unauthorized errors
  if (response.status === 401) {
    await SecureStore.deleteItemAsync('authToken');
    await profileCache.clearAll();
    throw new Error('Session expired. Please login again.');
  }
  
  return response;
};

/**
 * Handle API response with consistent error formatting
 */
const handleResponse = async (response: Response): Promise<any> => {
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with status ${response.status}`);
  }
  
  return data;
};

/**
 * Generate cache key
 */
const getCacheKey = (prefix: string, identifier?: string): string => {
  return identifier ? `${prefix}_${identifier}` : prefix;
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
      const response = await authFetch(`${BASE_URL}/api/profile/setup`, {
        method: 'POST',
        body: JSON.stringify(profileData)
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Setup profile error:', error);
      throw error;
    }
  },

  /**
   * Check if user has completed their profile setup
   */
  checkProfileStatus: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/status`, {
        method: 'GET',
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Check profile status error:', error);
      throw error;
    }
  },

  /**
   * Get authenticated user's detailed profile information
   */
  getProfileDetails: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/details`, {
        method: 'GET',
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Get profile details error:', error);
      throw error;
    }
  },

  /**
   * Get authenticated user's full profile with timestamps (WITH CACHING)
   */
  getMyProfile: async (forceRefresh: boolean = false) => {
    try {
      const token = await getToken();
      if (!token) {
        return { success: false, message: "No authentication token" };
      }
      
      const cacheKey = 'my_profile';
      
      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) {
          return { ...cached, _cached: true };
        }
        
        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) {
          return { ...stored, _cached: true };
        }
      }
      
      const response = await fetch(`${BASE_URL}/api/profile/my-profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error getting my profile:', error);
      return { success: false, message: error instanceof Error ? error.message : "Network error" };
    }
  },

  /**
   * Update profile information
   */
  updateProfile: async (profileData: any) => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/update`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Update profile error:', error);
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
      const response = await fetch(`${BASE_URL}/api/profile/upload-picture`, {
        method: 'POST',
        headers: await getFormDataHeaders(),
        body: formData,
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Upload profile picture error:', error);
      throw error;
    }
  },

  /**
   * Delete profile picture and reset to default avatar
   */
  deleteProfilePicture: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/picture`, {
        method: 'DELETE',
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Delete profile picture error:', error);
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
      const response = await fetch(`${BASE_URL}/api/profile/upload-cover-photo`, {
        method: 'POST',
        headers: await getFormDataHeaders(),
        body: formData,
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Upload cover photo error:', error);
      throw error;
    }
  },

  /**
   * Delete cover photo
   */
  deleteCoverPhoto: async () => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/cover-photo`, {
        method: 'DELETE',
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.invalidateUserProfile();
      }
      
      return result;
    } catch (error) {
      console.error('Delete cover photo error:', error);
      throw error;
    }
  },

  // ============================================
  // PUBLIC PROFILE OPERATIONS (WITH CACHING)
  // ============================================

  /**
   * Get public profile by user ID (WITH CACHING)
   */
  getPublicProfile: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey('public_profile', userId);
      
      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) {
          return { ...cached, _cached: true };
        }
        
        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) {
          return { ...stored, _cached: true };
        }
      }
      
      const token = await getToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${BASE_URL}/api/profile/public/${userId}`, {
        method: 'GET',
        headers
      });
      
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching public profile:', error);
      throw error;
    }
  },

  /**
   * Get public profile by username (WITH CACHING)
   */
  getProfileByUsername: async (username: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey('profile_username', username);
      
      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };
        
        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }
      
      const response = await authFetch(
        `${BASE_URL}/api/profile/username/${encodeURIComponent(username)}`,
        { method: 'GET' }
      );
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Get profile by username error:', error);
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
        `${BASE_URL}/api/profile/all?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Get all profiles error:', error);
      throw error;
    }
  },

  /**
   * Search profiles by name, username, major, or bio
   */
  searchProfiles: async (query: string, page: number = 1, limit: number = 20) => {
    try {
      if (!query.trim()) {
        return { success: false, profiles: [], pagination: { page: 1, limit, total: 0, pages: 0 } };
      }
      
      const response = await authFetch(
        `${BASE_URL}/api/profile/search?query=${encodeURIComponent(query.trim())}&page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Search profiles error:', error);
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
        `${BASE_URL}/api/profile/${userId}/posts?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Get user posts error:', error);
      throw error;
    }
  },

  /**
   * Get user activity statistics (WITH CACHING)
   */
  getUserStats: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey('user_stats', userId);
      
      if (!forceRefresh) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (cached) return { ...cached, _cached: true };
        
        const stored = await profileCache.getFromStorage(cacheKey);
        if (stored) return { ...stored, _cached: true };
      }
      
      const response = await authFetch(`${BASE_URL}/api/profile/${userId}/stats`, {
        method: 'GET',
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.saveToStorage(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error('Get user stats error:', error);
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
        `${BASE_URL}/api/profile/recommendations?limit=${limit}`,
        { method: 'GET' }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Get recommended profiles error:', error);
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
      const response = await authFetch(`${BASE_URL}/api/profile/block/${userId}`, {
        method: 'POST',
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.clear(`public_profile_${userId}`);
      }
      
      return result;
    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  },

  /**
   * Unblock a user
   */
  unblockUser: async (userId: string) => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/unblock/${userId}`, {
        method: 'POST',
      });
      const result = await handleResponse(response);
      
      if (result.success) {
        await profileCache.clear(`public_profile_${userId}`);
      }
      
      return result;
    } catch (error) {
      console.error('Unblock user error:', error);
      throw error;
    }
  },

  /**
   * Get list of blocked users
   */
  getBlockedUsers: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await authFetch(
        `${BASE_URL}/api/profile/blocked?page=${page}&limit=${limit}`,
        { method: 'GET' }
      );
      return await handleResponse(response);
    } catch (error) {
      console.error('Get blocked users error:', error);
      throw error;
    }
  },

  /**
   * Report a user for inappropriate behavior
   */
  reportUser: async (userId: string, reason: string, details?: string) => {
    try {
      const response = await authFetch(`${BASE_URL}/api/profile/report/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ reason, details: details || '' })
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Report user error:', error);
      throw error;
    }
  },

  // ============================================
  // BATCH OPERATIONS (FOR FASTER LOADING)
  // ============================================

  /**
   * Get complete profile data in one batch request
   */
  getProfileBatch: async (userId: string, forceRefresh: boolean = false) => {
    try {
      const cacheKey = getCacheKey('profile_batch', userId);
      
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
        profileService.getUserStats(userId, forceRefresh)
      ]);
      
      const result = {
        success: true,
        profile: profile.profile,
        user: profile.user,
        connectionStatus: profile.connectionStatus,
        recentPosts: posts.posts || [],
        stats: stats,
        isOwnProfile: profile.isOwnProfile || false
      };
      
      await profileCache.saveToStorage(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Batch profile fetch error:', error);
      throw error;
    }
  },

  // ============================================
  // ADDITIONAL UTILITIES
  // ============================================

  /**
   * Get full image URL for profile pictures
   */
  getFullImageUrl: (url: string | null | undefined): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    
    const baseUrl = BASE_URL.endsWith('/') 
      ? BASE_URL.slice(0, -1) 
      : BASE_URL;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${baseUrl}${cleanUrl}`;
  },

  /**
   * Clear all profile-related cache (for logout)
   */
  clearCache: async () => {
    await profileCache.clearAll();
  },

  /**
   * Prefetch profile data for faster navigation
   */
  prefetchProfile: async (userId: string): Promise<void> => {
    try {
      await profileService.getProfileBatch(userId, false);
    } catch (error) {
      console.error('Prefetch error:', error);
    }
  }
};

// ============================================
// TYPE DEFINITIONS
// ============================================

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
  connectionStatus?: {
    isConnected: boolean;
    isPending?: boolean;
    isBlocked?: boolean;
  };
  stats?: {
    postCount: number;
    connectionCount: number;
  };
  message?: string;
}

export interface SearchProfilesResponse {
  success: boolean;
  profiles: Array<{
    user: User;
    profile: Profile;
    connectionStatus: 'connected' | 'pending' | 'not_connected';
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

// Export individual functions for easier imports
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
  getUserPosts,
  getUserStats,
  getRecommendedProfiles,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  getFullImageUrl,
  clearCache,
  getProfileBatch,
  prefetchProfile
} = profileService;

export { profileCache };