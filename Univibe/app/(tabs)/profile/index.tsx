// app/(tabs)/profile/index.tsx - Fixed version

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  View,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "../../../lib/AuthContext";
import { useImageUpload } from "../../../hooks/useImageUpload";
import { useCoverPhotoUpload } from "../../../hooks/useCoverPhotoUpload";
import { connectionService } from "../../../lib/connectionService";
import { API_BASE_URL } from "../../../constants/ipConstants";

import ProfileHeader from "@/app/components/Profile/ProfileHeader";
import ProfileInfo from "@/app/components/Profile/ProfileInfo";
import ProfileStats from "@/app/components/Profile/ProfileStats";
import UploadModal from "@/app/components/Profile/UploadModal";
import ImageViewModal from "@/app/components/Profile/ImageViewModal";
import { styles } from "@/app/components/Profile/profileStyles";

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    return null;
  }
};

export default function ProfileScreen() {
  const { user, profile, isLoading, logout, loadProfile, refreshUserProfile } =
    useAuth();
  const [postCount, setPostCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);

  // Image upload hooks
  const {
    uploadModal,
    viewPhotoModal,
    uploading,
    openUploadModal,
    closeUploadModal,
    openImageViewer,
    closeImageViewer,
    uploadProfileImage,
    deleteProfileImage,
  } = useImageUpload();

  const {
    coverModal,
    coverViewModal,
    coverUploading,
    openCoverModal,
    closeCoverModal,
    openCoverImageViewer,
    closeCoverImageViewer,
    uploadCoverPhoto,
    deleteCoverPhoto,
  } = useCoverPhotoUpload();

  const pickerActiveRef = useRef(false);
  const router = useRouter();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Fetch user's post count
   */
  const fetchPostCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/posts/user/${user.id}/count`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (data.success && isMounted.current) {
        setPostCount(data.count);
      }
    } catch (error) {
      // Silent fail
    }
  }, [user?.id]);

  /**
   * Fetch user's connection count
   */
  const fetchConnectionCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await connectionService.getConnectionCount(user.id);
      if (response.success && response.data && isMounted.current) {
        setConnectionCount(response.data.connectionCount);
      }
    } catch (error) {
      // Silent fail
    }
  }, [user?.id]);

  /**
   * Load initial data
   */
  const loadInitialData = useCallback(async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;

    await loadProfile();
    await fetchPostCount();
    await fetchConnectionCount();

    refreshInProgress.current = false;
  }, [loadProfile, fetchPostCount, fetchConnectionCount]);

  /**
   * Refresh all data (for pull-to-refresh)
   */
  const onRefresh = async () => {
    if (refreshing || refreshInProgress.current) return;

    setRefreshing(true);
    await loadProfile();
    await refreshUserProfile();
    await fetchPostCount();
    await fetchConnectionCount();
    setRefreshing(false);
  };

  // Load profile on mount only once
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Reload counts when profile changes
  useEffect(() => {
    if (profile) {
      fetchPostCount();
      fetchConnectionCount();
    }
  }, [profile, fetchPostCount, fetchConnectionCount]);

  // Refresh on screen focus - but only once per focus
  useFocusEffect(
    useCallback(() => {
      // Don't auto-refresh on every focus to avoid loops
      // Just update counts silently
      if (user?.id && !refreshInProgress.current) {
        fetchPostCount();
        fetchConnectionCount();
      }
    }, [user?.id, fetchPostCount, fetchConnectionCount]),
  );

  const handleLogoutConfirm = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.push("/(auth)/login");
        },
      },
    ]);
  };

  // ============ PROFILE PICTURE HANDLERS ============

  const handleGalleryPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload profile pictures.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      console.error("Gallery pick error:", error);
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleCameraPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteProfileImage = async () => {
    const success = await deleteProfileImage();
    if (success) {
      closeUploadModal();
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  };

  const handleImagePress = () => {
    if (profile?.profilePicture) {
      openUploadModal();
    } else {
      Alert.alert(
        "Upload Profile Picture",
        "You don't have a profile picture yet. Would you like to add one?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upload", onPress: openUploadModal },
        ],
      );
    }
  };

  // ============ COVER PHOTO HANDLERS ============

  const handleCoverGalleryPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload cover photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      closeCoverModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      console.error("Cover gallery error:", error);
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleCoverCameraPick = async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      closeCoverModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      console.error("Cover camera error:", error);
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteCoverPhoto = async () => {
    const success = await deleteCoverPhoto();
    if (success) {
      closeCoverModal();
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  };

  const handleCoverPhotoPress = () => openCoverModal();

  // ============ RENDER HELPERS ============

  const formattedUser = {
    _id: user?.id,
    name: user?.name || profile?.fullName,
    email: user?.email,
    username: user?.username || profile?.username,
    profileComplete: user?.profileComplete,
  };

  const renderMenuItems = () => (
    <View style={menuStyles.menuSection}>
      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={() => router.push("/profile/edit")}
        activeOpacity={0.7}
      >
        <View style={menuStyles.menuItemContent}>
          <Ionicons name="create-outline" size={24} color="#4b5563" />
          <Text style={menuStyles.menuText}>Edit Profile</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
      </TouchableOpacity>

      <View style={menuStyles.divider} />

      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={() =>
          Alert.alert("Coming Soon", "Settings feature coming soon!")
        }
        activeOpacity={0.7}
      >
        <View style={menuStyles.menuItemContent}>
          <Ionicons name="settings-outline" size={24} color="#4b5563" />
          <Text style={menuStyles.menuText}>Settings</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
      </TouchableOpacity>

      <View style={menuStyles.divider} />

      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={() =>
          Alert.alert("Coming Soon", "Help & Support coming soon!")
        }
        activeOpacity={0.7}
      >
        <View style={menuStyles.menuItemContent}>
          <Ionicons name="help-circle-outline" size={24} color="#4b5563" />
          <Text style={menuStyles.menuText}>Help & Support</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#9ca3af" />
      </TouchableOpacity>

      <View style={menuStyles.divider} />

      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={handleLogoutConfirm}
        activeOpacity={0.7}
      >
        <View style={menuStyles.menuItemContent}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          <Text style={[menuStyles.menuText, { color: "#ef4444" }]}>
            Logout
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  // Loading state
  if (isLoading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noProfileContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#d1d5db" />
          <Text style={styles.noProfileTitle}>Complete Your Profile</Text>
          <Text style={styles.noProfileDescription}>
            Setup your profile to connect with other students
          </Text>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => router.push("/(auth)/setup-profile")}
          >
            <Ionicons name="person-add-outline" size={20} color="white" />
            <Text style={styles.setupButtonText}>Setup Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      >
        <ProfileHeader
          user={formattedUser}
          profile={profile}
          uploading={uploading || pickerActiveRef.current}
          coverUploading={coverUploading}
          onImagePress={handleImagePress}
          onCoverPhotoPress={handleCoverPhotoPress}
        />

        <View style={styles.content}>
          <ProfileInfo profile={profile} user={user} />
          <ProfileStats
            stats={{
              posts: postCount,
              connections: connectionCount,
              groups: profile?.stats?.groups || 0,
            }}
          />
          {renderMenuItems()}
        </View>
      </ScrollView>

      {/* Modals */}
      <UploadModal
        visible={uploadModal}
        onClose={closeUploadModal}
        onViewImage={openImageViewer}
        onPickImage={handleGalleryPick}
        onTakePhoto={handleCameraPick}
        onDeletePhoto={handleDeleteProfileImage}
        hasExistingImage={
          !!profile?.profilePicture &&
          !profile.profilePicture.includes("dicebear.com")
        }
        title="Profile Picture"
        viewLabel="View Profile Picture"
        deleteLabel="Remove Profile Picture"
      />

      <UploadModal
        visible={coverModal}
        onClose={closeCoverModal}
        onViewImage={openCoverImageViewer}
        onPickImage={handleCoverGalleryPick}
        onTakePhoto={handleCoverCameraPick}
        onDeletePhoto={handleDeleteCoverPhoto}
        hasExistingImage={!!profile?.coverPhoto}
        title="Cover Photo"
        viewLabel="View Cover Photo"
      />

      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={profile?.profilePicture}
        onClose={closeImageViewer}
        title="Profile Picture"
        isCoverPhoto={false}
      />

      <ImageViewModal
        visible={coverViewModal}
        imageUri={profile?.coverPhoto}
        onClose={closeCoverImageViewer}
        title="Cover Photo"
        isCoverPhoto={true}
      />
    </SafeAreaView>
  );
}

const menuStyles = StyleSheet.create({
  menuSection: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
    marginTop: 16,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
    marginLeft: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 20,
  },
});
