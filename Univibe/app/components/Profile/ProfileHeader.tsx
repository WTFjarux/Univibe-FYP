import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../../constants/stringConstants";
import ImageViewModal from "./ImageViewModal"; // Adjust the import path as needed

// ============================================
// INTERFACE DEFINITIONS
// ============================================

interface ProfileHeaderProps {
  user?: {
    _id?: string;
    username?: string;
    name?: string;
    email?: string;
    profileComplete?: boolean;
  };
  profile?: {
    fullName?: string;
    username?: string;
    profilePicture?: string;
    coverPhoto?: string;
    bio?: string;
  };
  uploading?: boolean;
  coverUploading?: boolean;
  onImagePress: () => void;
  onCoverPhotoPress: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalizes cover photo URL from various formats to a full, usable URL
 */
const normalizeCoverPhotoUrl = (
  coverPhoto: string | undefined,
): string | null => {
  if (!coverPhoto || coverPhoto.trim() === "") {
    return null;
  }

  // Already a full URL - return as is
  if (coverPhoto.startsWith("http://") || coverPhoto.startsWith("https://")) {
    return coverPhoto;
  }

  // Relative path starting with /uploads/
  if (coverPhoto.startsWith("/uploads/")) {
    return `${API_BASE_URL}${coverPhoto}`;
  }

  // Filename pattern for cover photos
  if (coverPhoto.includes("cover-photo-")) {
    return `${API_BASE_URL}/uploads/cover-photos/${coverPhoto}`;
  }

  // Default case - assume it's a relative path
  return `${API_BASE_URL}/${coverPhoto}`;
};

/**
 * Returns profile picture URL with DiceBear fallback
 */
const getProfilePictureUrl = (
  profilePic: string | undefined,
  username: string,
): string => {
  if (!profilePic || profilePic.trim() === "") {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  }
  return profilePic;
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProfileHeader({
  user = {},
  profile = {},
  uploading = false,
  coverUploading = false,
  onImagePress,
  onCoverPhotoPress,
}: ProfileHeaderProps) {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  // ============================================
  // DATA EXTRACTION & PROCESSING
  // ============================================

  // Extract username from user or profile data
  const username = user?.username || profile?.username || "user";

  // Extract full name from profile or user data
  const fullName = profile?.fullName || user?.name || "User";

  // Get normalized image URLs
  const profilePictureUrl = getProfilePictureUrl(
    profile?.profilePicture,
    username,
  );
  const coverPhotoUrl = normalizeCoverPhotoUrl(profile?.coverPhoto);

  // Check if user has a custom profile picture (not DiceBear)
  const hasCustomProfilePicture =
    profile?.profilePicture && profile.profilePicture.trim() !== "";

  // Check if user has completed profile for verification badge
  const showVerifiedBadge = user?.profileComplete;

  // ============================================
  // HANDLER FUNCTIONS
  // ============================================

  /**
   * Handles single tap on profile picture - opens upload modal
   */
  const handleProfilePicturePress = () => {
    // Only trigger upload if not currently uploading
    if (!uploading) {
      onImagePress();
    }
  };

  /**
   * Handles long press on profile picture - opens image viewer
   */
  const handleProfilePictureLongPress = () => {
    // Only open viewer if user has a custom profile picture
    if (hasCustomProfilePicture && !uploading) {
      setImageViewerVisible(true);
    }
  };

  /**
   * Closes the image viewer modal
   */
  const closeImageViewer = () => {
    setImageViewerVisible(false);
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  /**
   * Renders the cover photo section with camera overlay
   */
  const renderCoverPhotoSection = () => (
    <View style={styles.coverPhotoContainer}>
      {coverPhotoUrl ? (
        <Image
          source={{ uri: coverPhotoUrl }}
          style={styles.coverPhoto}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.defaultCover}>
          <Ionicons name="images" size={40} color="rgba(0, 0, 0, 0.7)" />
        </View>
      )}

      {/* Camera overlay button for cover photo */}
      <TouchableOpacity
        style={styles.coverCameraButton}
        onPress={onCoverPhotoPress}
        disabled={coverUploading}
      >
        <View style={styles.cameraButtonInner}>
          {coverUploading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="camera" size={20} color="white" />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders the profile picture with camera overlay
   */
  const renderProfilePicture = () => (
    <TouchableOpacity
      onPress={handleProfilePicturePress} // Single tap: upload modal
      onLongPress={handleProfilePictureLongPress} // Long press: image viewer
      activeOpacity={0.7}
      disabled={uploading}
      style={styles.profileImageWrapper}
      delayLongPress={500} // 500ms delay for long press
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: profilePictureUrl }}
          style={styles.profileImage}
        />

        {/* Small camera icon overlay */}
        <View style={styles.profileCameraOverlay}>
          <Ionicons name="camera" size={16} color="white" />
        </View>

        {/* Loading overlay when uploading */}
        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="white" size="small" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  /**
   * Renders the name and username section
   */
  const renderNameSection = () => (
    <View style={styles.nameUsernameContainer}>
      <Text style={styles.fullName} numberOfLines={2}>
        {fullName}
      </Text>
      <View style={styles.usernameContainer}>
        <Text style={styles.username}>@{username}</Text>
        {showVerifiedBadge && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#10b981" />
          </View>
        )}
      </View>
    </View>
  );

  /**
   * Renders the bio section (conditionally)
   */
  const renderBioSection = () => {
    if (!profile?.bio) return null;

    return (
      <View style={styles.bioContainer}>
        <Text style={styles.bio}>{profile.bio}</Text>
      </View>
    );
  };

  /**
   * Renders the image viewer modal
   */
  const renderImageViewerModal = () => (
    <ImageViewModal
      visible={imageViewerVisible}
      imageUri={profilePictureUrl}
      onClose={closeImageViewer}
      title={fullName}
      isCoverPhoto={false}
    />
  );

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <View style={styles.headerContainer}>
      {/* Main header with cover photo and profile info */}
      <View style={styles.header}>
        {renderCoverPhotoSection()}

        {/* Profile image and name container positioned over cover photo */}
        <View style={styles.profileImageNameContainer}>
          {renderProfilePicture()}
          {renderNameSection()}
        </View>
      </View>

      {/* Bio section (appears below header) */}
      {renderBioSection()}

      {/* Image viewer modal */}
      {renderImageViewerModal()}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Main container
  headerContainer: {
    marginBottom: 8,
  },

  // Header wrapper
  header: {
    position: "relative",
    height: 240,
  },

  // COVER PHOTO STYLES
  coverPhotoContainer: {
    height: 180,
    position: "relative",
    backgroundColor: "#000000",
  },

  coverPhoto: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  defaultCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#9b9b9b8f",
    justifyContent: "center",
    alignItems: "center",
  },

  coverCameraButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
  },

  cameraButtonInner: {
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },

  // PROFILE IMAGE & NAME CONTAINER
  profileImageNameContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    position: "absolute",
    bottom: 0,
    left: 20,
    right: 20,
  },

  profileImageWrapper: {
    marginRight: 16,
  },

  imageContainer: {
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },

  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#f1f5f9",
  },

  profileCameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  // NAME & USERNAME STYLES
  nameUsernameContainer: {
    flex: 1,
    marginBottom: 10,
  },

  fullName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },

  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  username: {
    color: "#6b7280",
    fontSize: 16,
    marginRight: 8,
  },

  verifiedBadge: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 1,
  },

  // BIO SECTION STYLES
  bioContainer: {
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 8,
  },

  bio: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 20,
    color: "#000000",
  },
});
