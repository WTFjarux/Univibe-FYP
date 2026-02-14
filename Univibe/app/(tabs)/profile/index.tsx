// app/(tabs)/profile/index.tsx - UPDATED VERSION
import React, { useRef, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";

import { useAuth } from "../../../lib/AuthContext";
import { useImageUpload } from "../../../hooks/useImageUpload";
import { useCoverPhotoUpload } from "../../../hooks/useCoverPhotoUpload"; // NEW

import ProfileHeader from "../../components/Profile/ProfileHeader";
import ProfileInfo from "../../components/Profile/ProfileInfo";
import ProfileStats from "../../components/Profile/ProfileStats";
import UploadModal from "../../components/Profile/UploadModal";
import ImageViewModal from "../../components/Profile/ImageViewModal";
import { styles } from "../../components/Profile/profileStyles";

export default function ProfileScreen() {
  const { user, profile, isLoading, logout, loadProfile } = useAuth();

  // Profile picture upload hook
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

  // Cover photo upload hook
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

  const [refreshing, setRefreshing] = useState(false);
  const pickerActiveRef = useRef(false);
  const router = useRouter();

  // Load profile on mount if not loaded
  useEffect(() => {
    if (!profile && !isLoading) {
      loadProfile();
    }
  }, [profile, isLoading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

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

  // PROFILE PICTURE HANDLERS (existing)
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
          pickerActiveRef.current = false;
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
        }
      }
    } catch (error) {
      console.error("Gallery picker error:", error);
      Alert.alert("Error", "Failed to select image from gallery");
      closeUploadModal();
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
          pickerActiveRef.current = false;
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
        }
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
      closeUploadModal();
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteProfileImage = async () => {
    const success = await deleteProfileImage();
    if (success) {
      closeUploadModal();
      await loadProfile();
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

  // COVER PHOTO HANDLERS (NEW)
  const handleCoverPhotoPress = () => {
    openCoverModal();
  };

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
          pickerActiveRef.current = false;
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9], // Better aspect ratio for cover photos
        quality: 0.8,
      });

      closeCoverModal();

      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await loadProfile();
        }
      }
    } catch (error) {
      console.error("Cover gallery picker error:", error);
      Alert.alert("Error", "Failed to select image from gallery");
      closeCoverModal();
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
          pickerActiveRef.current = false;
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
        }
      }
    } catch (error) {
      console.error("Cover camera error:", error);
      Alert.alert("Error", "Failed to take photo");
      closeCoverModal();
    } finally {
      pickerActiveRef.current = false;
    }
  };

  const handleDeleteCoverPhoto = async () => {
    const success = await deleteCoverPhoto();
    if (success) {
      closeCoverModal();
      await loadProfile();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
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

  const renderMenuItems = () => (
    <View style={menuStyles.menuSection}>
      {/* Edit Profile */}
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

      {/* Settings */}
      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={() =>
          Alert.alert("Coming Soon", "Settings feature will be available soon!")
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

      {/* Help & Support */}
      <TouchableOpacity
        style={menuStyles.menuItem}
        onPress={() =>
          Alert.alert(
            "Coming Soon",
            "Help & Support feature will be available soon!",
          )
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

      {/* Logout */}
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
          user={user}
          profile={profile}
          uploading={uploading || pickerActiveRef.current}
          coverUploading={coverUploading}
          onImagePress={handleImagePress}
          onCoverPhotoPress={handleCoverPhotoPress}
        />

        <View style={styles.content}>
          <ProfileInfo profile={profile} user={user} />
          <ProfileStats
            stats={profile?.stats || { posts: 0, connections: 0, groups: 0 }}
          />
          {renderMenuItems()}
        </View>
      </ScrollView>

      {/* Profile Picture Upload Modal */}
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
        } // Check if it's not a default avatar
        title="Profile Picture"
        viewLabel="View Profile Picture"
        deleteLabel="Remove Profile Picture"
      />

      {/* Cover Photo Upload Modal */}
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

      {/* Profile Picture Viewer Modal */}
      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={profile?.profilePicture}
        onClose={closeImageViewer}
        title="Profile Picture"
        isCoverPhoto={false} // Default is false anyway
      />

      {/* Cover Photo Viewer Modal */}
      <ImageViewModal
        visible={coverViewModal}
        imageUri={profile?.coverPhoto}
        onClose={closeCoverImageViewer}
        title="Cover Photo"
        isCoverPhoto={true} // This will make it rectangular
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
