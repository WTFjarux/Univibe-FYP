// app/lib/profileService.ts
import * as SecureStore from 'expo-secure-store'; 
import { API_BASE_URL } from '../constants/ipConstants'; 

const getToken = async (): Promise<string> => {
  const token = await SecureStore.getItemAsync('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

const getHeaders = async (): Promise<HeadersInit> => ({
  'Authorization': `Bearer ${await getToken()}`,
  'Content-Type': 'application/json'
});

const getFormDataHeaders = async (): Promise<HeadersInit> => ({
  'Authorization': `Bearer ${await getToken()}`
});

const getMimeType = (filename: string): string => {
  const extension = filename.toLowerCase();
  if (extension.endsWith('.png')) return 'image/png';
  if (extension.endsWith('.gif')) return 'image/gif';
  if (extension.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

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

export const profileService = {
  // Profile Setup & Basic Operations
  setupProfile: async (profileData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/setup`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  checkProfileStatus: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/status`, {
        method: 'GET',
        headers: await getHeaders()
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  getProfileDetails: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/details`, {
        method: 'GET',
        headers: await getHeaders()
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  updateProfile: async (profileData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'PUT',
        headers: await getHeaders(),
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Profile Picture Operations
  uploadProfilePicture: async (imageUri: string) => {
    try {
      const formData = createImageFormData(imageUri, 'profilePicture');
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-picture`, {
        method: 'POST',
        headers: await getFormDataHeaders(),
        body: formData,
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  deleteProfilePicture: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/picture`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Cover Photo Operations
  uploadCoverPhoto: async (imageUri: string) => {
    try {
      const formData = createImageFormData(imageUri, 'coverPhoto');
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-cover-photo`, {
        method: 'POST',
        headers: await getFormDataHeaders(),
        body: formData,
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  deleteCoverPhoto: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/cover-photo`, {
        method: 'DELETE',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Public Profile Operations
  getPublicProfile: async (userId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
      method: 'GET',
      headers: await getHeaders()
    });
    const data = await response.json();
    
    // Log the response for debugging
    console.log('Public profile response:', data);
    
    return data;
  } catch (error) {
    console.error('Error fetching public profile:', error);
    throw error;
  }
},

  getProfileByUsername: async (username: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/username/${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: await getHeaders()
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Follow/Unfollow Operations
  toggleFollow: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/follow/${userId}`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  checkFollowStatus: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/follow/status/${userId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  getFollowers: async (userId: string, page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/${userId}/followers?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders(),
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  getFollowing: async (userId: string, page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/${userId}/following?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders(),
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Search and List Operations
  getAllProfiles: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/all?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders()
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  searchProfiles: async (query: string, page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders()
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Connection Recommendations
  getRecommendedProfiles: async (limit: number = 10) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/recommendations?limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders()
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Mutual Connections
  getMutualConnections: async (userId: string, page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/${userId}/mutual-connections?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders(),
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Block/Unblock User
  blockUser: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/block/${userId}`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  unblockUser: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/unblock/${userId}`, {
        method: 'POST',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  getBlockedUsers: async (page: number = 1, limit: number = 20) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/blocked?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders(),
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Report User
  reportUser: async (userId: string, reason: string, details?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/report/${userId}`, {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({ reason, details })
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // User Activity Stats
  getUserStats: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}/stats`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // User's Posts (for profile view)
  getUserPosts: async (userId: string, page: number = 1, limit: number = 10) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/${userId}/posts?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getHeaders(),
        }
      );
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Check if user is following
  isFollowing: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/is-following/${userId}`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Get follower count
  getFollowerCount: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}/follower-count`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // Get following count
  getFollowingCount: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${userId}/following-count`, {
        method: 'GET',
        headers: await getHeaders(),
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};

