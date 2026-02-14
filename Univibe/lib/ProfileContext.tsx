// app/lib/ProfileContext.tsx 
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { profileService } from './profileService';

interface ProfileContextType {
  profile: any | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  setupProfile: (data: any) => Promise<any>;
  updateProfile: (data: any) => Promise<any>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token, user } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadProfile();
    } else {
      setProfile(null);
    }
  }, [isAuthenticated]);

  const loadProfile = async () => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 Loading profile data...');
      const profileData = await profileService.getProfileDetails();
      
      if (profileData && !profileData.error) {
        console.log('✅ Profile loaded:', profileData);
        setProfile(profileData);
      } else {
        console.log('⚠️ Profile not found or error:', profileData);
        setProfile(null);
        // Set error if profile doesn't exist but user is authenticated
        setError('Profile not found. Please setup your profile.');
      }
    } catch (err: any) {
      console.error('❌ Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  const setupProfile = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🛠️ Setting up profile...');
      const result = await profileService.setupProfile(data);
      
      if (result && !result.error) {
        console.log('✅ Profile setup successful:', result);
        setProfile(result);
        return result;
      } else {
        throw new Error(result?.message || 'Profile setup failed');
      }
    } catch (err: any) {
      console.error('❌ Profile setup error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Updating profile...');
      const updated = await profileService.updateProfile(data);
      
      if (updated && !updated.error) {
        console.log('✅ Profile updated:', updated);
        setProfile(updated);
        return updated;
      } else {
        throw new Error(updated?.message || 'Profile update failed');
      }
    } catch (err: any) {
      console.error('❌ Profile update error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfileContext.Provider value={{ 
      profile, 
      loading, 
      error, 
      refreshProfile, 
      setupProfile, 
      updateProfile 
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};