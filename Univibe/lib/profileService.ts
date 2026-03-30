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

  getPublicProfile: async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/public/${userId}`, {
        method: 'GET',
        headers: await getHeaders()
      });
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

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

  searchProfiles: async (query: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}`,
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
  }
};