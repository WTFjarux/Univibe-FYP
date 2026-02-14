// app/lib/profileService.ts
import * as SecureStore from 'expo-secure-store'; 
import { API_BASE_URL } from '../constants/stringConstants'; 

const getToken = async (): Promise<string> => {
  const token = await SecureStore.getItemAsync('authToken');
  if (!token) {
    throw new Error('No authentication token found');
  }
  return token;
};

export const profileService = {
  // Profile setup and management
  setupProfile: async (profileData: any) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error setting up profile:', error);
      throw error;
    }
  },

  checkProfileStatus: async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error checking profile status:', error);
      throw error;
    }
  },

  getProfileDetails: async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile details:', error);
      throw error;
    }
  },

  updateProfile: async (profileData: any) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });
      return await response.json();
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  },

  // Image upload functions
  uploadProfilePicture: async (imageUri: string) => {
    try {
      const token = await getToken();
      
      // Create FormData
      const formData = new FormData();
      
      // Get filename from URI
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      
      // Determine mime type
      let mimeType = 'image/jpeg';
      const extension = filename.toLowerCase();
      if (extension.endsWith('.png')) {
        mimeType = 'image/png';
      } else if (extension.endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (extension.endsWith('.webp')) {
        mimeType = 'image/webp';
      }
      
      // Append file to FormData (must match backend field name 'profilePicture')
      formData.append('profilePicture', {
        uri: imageUri,
        name: filename,
        type: mimeType,
      } as any);
      
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary
        },
        body: formData,
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  },

  deleteProfilePicture: async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/picture`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      throw error;
    }
  },
  // Upload cover photo
  uploadCoverPhoto: async (imageUri: string) => {
    try {
      const token = await getToken();
      
      // Create FormData
      const formData = new FormData();
      
      // Get filename from URI
      const filename = imageUri.split('/').pop() || 'cover-photo.jpg';
      
      // Determine mime type
      let mimeType = 'image/jpeg';
      const extension = filename.toLowerCase();
      if (extension.endsWith('.png')) {
        mimeType = 'image/png';
      } else if (extension.endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (extension.endsWith('.webp')) {
        mimeType = 'image/webp';
      }
      
      // Append file to FormData (must match backend field name 'coverPhoto')
      formData.append('coverPhoto', {
        uri: imageUri,
        name: filename,
        type: mimeType,
      } as any);
      
      const response = await fetch(`${API_BASE_URL}/api/profile/upload-cover-photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let fetch set it with boundary
        },
        body: formData,
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error uploading cover photo:', error);
      throw error;
    }
  },

  // Delete cover photo
  deleteCoverPhoto: async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/cover-photo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting cover photo:', error);
      throw error;
    }
  },


  // Public profile viewing
  getPublicProfile: async (userId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching public profile:', error);
      throw error;
    }
  },

  // Explore profiles
  getAllProfiles: async (page: number = 1, limit: number = 20) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/profile/all?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Error fetching all profiles:', error);
      throw error;
    }
  },

  searchProfiles: async (query: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Error searching profiles:', error);
      throw error;
    }
  },

  getProfileByUsername: async (username: string) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${API_BASE_URL}/api/profile/username/${encodeURIComponent(username)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Error fetching profile by username:', error);
      throw error;
    }
  }
};