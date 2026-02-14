import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { profileService } from '../lib/profileService';

export interface User {
  _id: string;
  username: string;
  email: string;
  profileComplete: boolean;
}

export interface Profile {
  _id: string;
  fullName: string;
  profilePicture: string;
  bio: string;
  major: string;
  year: string;
  graduationYear: string;
  pronouns: string;
  universityEmail: string;
  socialLinks: {
    instagram?: string;
    linkedin?: string;
  };
  interests: string[];
  stats: {
    posts: number;
    connections: number;
    groups: number;
  };
}

export interface ProfileData {
  user: User;
  profile: Profile;
}

export const useProfile = () => {
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ ADDED: Function to update profile picture locally
  const updateProfilePicture = useCallback((newImageUrl: string) => {
    setProfileData(prev => {
      if (!prev) return prev;
      
      const updated = {
        ...prev,
        profile: {
          ...prev.profile,
          profilePicture: newImageUrl
        }
      };
      
      // Update cache
      SecureStore.setItemAsync('profile_data', JSON.stringify(updated));
      
      return updated;
    });
  }, []);

  const loadProfile = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      // Load from cache first
      const cached = await SecureStore.getItemAsync('profile_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed?.user) {
            setProfileData(parsed);
          }
        } catch (e) {
          console.warn('Failed to parse cached profile:', e);
        }
      }

      // Fetch from API
      const response = await profileService.getProfileDetails();
      
      if (response.success && response.data?.user) {
        const data: ProfileData = {
          user: response.data.user,
          profile: response.data.profile || createDefaultProfile(response.data.user)
        };
        
        setProfileData(data);
        await SecureStore.setItemAsync('profile_data', JSON.stringify(data));
      } else {
        // If API fails but we have cached data, keep it
        if (!cached) {
          setProfileData(null);
        }
      }
    } catch (error: any) {
      setError(error.message);
      console.error('Error loading profile:', error);
      
      // ✅ ADDED: Show user-friendly error message
      if (error.message.includes('Network Error') || error.message.includes('timeout')) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to server. Please check your internet connection.'
        );
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    setRefreshing(true);
    await loadProfile(false); // Don't show loading overlay
    setRefreshing(false);
  }, [loadProfile]);

  const logout = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('profile_data');
      await SecureStore.deleteItemAsync('profile_complete');
      setProfileData(null); // Clear state immediately
      router.replace('/landingPage');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const editProfile = useCallback(() => {
    router.push('/(tabs)/profile/edit');
  }, []);

  const setupProfile = useCallback(() => {
    router.push('/(auth)/setup-profile');
  }, []);

  // Initial load
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return {
    profileData,
    loading,
    refreshing,
    error,
    loadProfile,
    refreshProfile,
    logout,
    editProfile,
    setupProfile,
    updateProfilePicture, // ✅ ADDED: Export the update function
  };
};

function createDefaultProfile(user: any): Profile {
  return {
    _id: user._id,
    fullName: user.name || user.username,
    profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username || 'user'}`,
    bio: '',
    major: 'Not specified',
    year: 'Not specified',
    graduationYear: 'Not specified',
    pronouns: '',
    universityEmail: user.email || '',
    socialLinks: {},
    interests: [],
    stats: { posts: 0, connections: 0, groups: 0 }
  };
}