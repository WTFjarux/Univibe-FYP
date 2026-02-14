// hooks/useCoverPhotoUpload.ts
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { profileService } from '../lib/profileService';

export const useCoverPhotoUpload = () => {
  const [coverModal, setCoverModal] = useState(false);
  const [coverViewModal, setCoverViewModal] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const openCoverModal = useCallback(() => {
    console.log('📱 Opening cover photo upload modal');
    setCoverModal(true);
  }, []);

  const closeCoverModal = useCallback(() => {
    setCoverModal(false);
  }, []);

  const openCoverImageViewer = useCallback(() => {
    console.log('📱 Opening cover photo viewer');
    setCoverModal(false);
    setCoverViewModal(true);
  }, []);

  const closeCoverImageViewer = useCallback(() => {
    setCoverViewModal(false);
  }, []);

  const uploadCoverPhoto = useCallback(async (imageUri: string): Promise<boolean> => {
    console.log('🚀 Starting cover photo upload');
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
    
    setCoverUploading(true);
    
    try {
      console.log('📤 Uploading cover photo to server...');
      
      const result = await profileService.uploadCoverPhoto(imageUri);
      
      console.log('📤 Server response:', {
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Cover photo updated successfully!');
        return true;
      } else {
        Alert.alert('Upload Failed', result.message || 'Failed to update cover photo');
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ Cover Photo Upload Error:', error);
      
      let errorMessage = 'Failed to upload cover photo';
      
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
      console.log('🏁 Cover photo upload process completed');
      setCoverUploading(false);
    }
  }, []);

  const deleteCoverPhoto = useCallback(async (): Promise<boolean> => {
    try {
      const result = await profileService.deleteCoverPhoto();
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Cover photo removed');
        return true;
      }
      
      Alert.alert('Error', result.message || 'Failed to delete cover photo');
      return false;
      
    } catch (error: any) {
      console.error('Delete cover photo error:', error);
      Alert.alert('Error', 'Failed to delete cover photo. Please try again.');
      return false;
    }
  }, []);

  return {
    // State
    coverModal,
    coverViewModal,
    coverUploading,
    
    // Modal controls
    setCoverModal,
    setCoverViewModal,
    openCoverModal,
    closeCoverModal,
    openCoverImageViewer,
    closeCoverImageViewer,
    
    // Image operations
    uploadCoverPhoto,
    deleteCoverPhoto,
  };
};