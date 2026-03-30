import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../../constants/stringConstants";
import ImageViewModal from "./ImageViewModal";

// ============================================
// LOCAL ASSETS
// ============================================

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../assets/images/default-avatar.png");

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

  if (coverPhoto.startsWith("http://") || coverPhoto.startsWith("https://")) {
    return coverPhoto;
  }

  if (coverPhoto.startsWith("/uploads/")) {
    return `${API_BASE_URL}${coverPhoto}`;
  }

  if (coverPhoto.includes("cover-photo-")) {
    return `${API_BASE_URL}/uploads/cover-photos/${coverPhoto}`;
  }

  return `${API_BASE_URL}/${coverPhoto}`;
};

/**
 * Returns profile picture source (local or remote)
 * ✅ Uses local default avatar as fallback when no custom image exists
 */
const getProfilePictureSource = (
  profilePic: string | undefined,
): ImageSourcePropType => {
  // If there's a custom profile picture, use it
  if (profilePic && profilePic.trim() !== "") {
    let imageUrl = profilePic;

    // Normalize relative paths
    if (imageUrl.startsWith("/")) {
      imageUrl = `${API_BASE_URL}${imageUrl}`;
    }

    return { uri: imageUrl };
  }

  // ✅ Fallback to local default avatar
  return DEFAULT_AVATAR;
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
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  // Extract data from props
  const username = user?.username || profile?.username || "user";
  const fullName = profile?.fullName || user?.name || "User";
  const coverPhotoUrl = normalizeCoverPhotoUrl(profile?.coverPhoto);
  const hasCustomProfilePicture =
    profile?.profilePicture && profile.profilePicture.trim() !== "";
  const showVerifiedBadge = user?.profileComplete;
  const profilePictureSource = getProfilePictureSource(profile?.profilePicture);

  // Get remote URL for image viewer (only for custom images)
  const getImageViewerUri = (): string | undefined => {
    if (hasCustomProfilePicture && profile?.profilePicture) {
      let pic = profile.profilePicture;
      if (pic.startsWith("/")) {
        pic = `${API_BASE_URL}${pic}`;
      }
      return pic;
    }
    return undefined;
  };

  // Handlers
  const handleProfilePicturePress = () => {
    if (!uploading) {
      onImagePress();
    }
  };

  const handleProfilePictureLongPress = () => {
    if (hasCustomProfilePicture && !uploading) {
      setImageViewerVisible(true);
    }
  };

  const closeImageViewer = () => {
    setImageViewerVisible(false);
  };

  // Render functions
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

  const renderProfilePicture = () => (
    <TouchableOpacity
      onPress={handleProfilePicturePress}
      onLongPress={handleProfilePictureLongPress}
      activeOpacity={0.7}
      disabled={uploading}
      style={styles.profileImageWrapper}
      delayLongPress={500}
    >
      <View style={styles.imageContainer}>
        <Image source={profilePictureSource} style={styles.profileImage} />

        <View style={styles.profileCameraOverlay}>
          <Ionicons name="camera" size={16} color="white" />
        </View>

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator color="white" size="small" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

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

  const renderBioSection = () => {
    if (!profile?.bio) return null;

    return (
      <View style={styles.bioContainer}>
        <Text style={styles.bio}>{profile.bio}</Text>
      </View>
    );
  };

  const renderImageViewerModal = () => {
    const imageUri = getImageViewerUri();

    if (!imageUri) return null;

    return (
      <ImageViewModal
        visible={imageViewerVisible}
        imageUri={imageUri}
        onClose={closeImageViewer}
        title={fullName}
        isCoverPhoto={false}
      />
    );
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.header}>
        {renderCoverPhotoSection()}

        <View style={styles.profileImageNameContainer}>
          {renderProfilePicture()}
          {renderNameSection()}
        </View>
      </View>

      {renderBioSection()}
      {renderImageViewerModal()}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  headerContainer: {
    marginBottom: 8,
  },

  header: {
    position: "relative",
    height: 240,
  },

  coverPhotoContainer: {
    height: 180,
    position: "relative",
    backgroundColor: "#e5e7eb",
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
