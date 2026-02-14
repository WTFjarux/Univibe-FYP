// hooks/useImageUpload.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { profileService } from '../lib/profileService';

export const useImageUpload = () => {
  const [uploadModal, setUploadModal] = useState(false);
  const [viewPhotoModal, setViewPhotoModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openUploadModal = useCallback(() => {
    console.log('📱 Opening upload modal');
    setUploadModal(true);
  }, []);

  const closeUploadModal = useCallback(() => {
    setUploadModal(false);
  }, []);

  const openImageViewer = useCallback(() => {
    console.log('📱 Opening image viewer');
    setUploadModal(false);
    setViewPhotoModal(true);
  }, []);

  const closeImageViewer = useCallback(() => {
    setViewPhotoModal(false);
  }, []);

  const uploadProfileImage = useCallback(async (imageUri: string): Promise<boolean> => {
    console.log('🚀 Starting image upload');
    console.log('📤 Image URI:', imageUri.substring(0, 200));
    
    if (!imageUri) {
      Alert.alert('Error', 'No image selected');
      return false;
    }
    
    // Validate URI format
    if (!imageUri.startsWith('file://') && 
        !imageUri.startsWith('ph://') && 
        !imageUri.startsWith('assets-library://')) {
      console.warn('⚠️ Unusual URI format detected');
    }
    
    setUploading(true);
    
    try {
      console.log('📤 Uploading to server...');
      
      const result = await profileService.uploadProfilePicture(imageUri);
      
      console.log('📤 Server response:', {
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Profile picture updated successfully!');
        return true;
      } else {
        Alert.alert('Upload Failed', result.message || 'Failed to update profile picture');
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ Upload Error:', error);
      
      let errorMessage = 'Failed to upload image';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // Network errors
      if (error.message?.includes('Network request failed')) {
        errorMessage = 'Cannot connect to server. Please check your connection and try again.';
      }
      
      // Token errors
      if (error.message?.includes('No authentication token') || 
          error.message?.includes('token') || 
          error.message?.includes('auth')) {
        errorMessage = 'Session expired. Please login again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
      return false;
      
    } finally {
      console.log('🏁 Upload process completed');
      setUploading(false);
    }
  }, []);

  const deleteProfileImage = useCallback(async (): Promise<boolean> => {
    try {
      const result = await profileService.deleteProfilePicture();
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Profile picture removed');
        return true;
      }
      
      Alert.alert('Error', result.message || 'Failed to delete profile picture');
      return false;
      
    } catch (error: any) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete profile picture. Please try again.');
      return false;
    }
  }, []);

  return {
    // State
    uploadModal,
    viewPhotoModal,
    uploading,
    
    // Modal controls
    setUploadModal,
    setViewPhotoModal,
    openUploadModal,
    closeUploadModal,
    openImageViewer,
    closeImageViewer,
    
    // Image operations
    uploadProfileImage,
    deleteProfileImage,
  };
};