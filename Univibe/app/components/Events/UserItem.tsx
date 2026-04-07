// app/components/Events/UserItem.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "@/constants/ipConstants";

const DEFAULT_AVATAR = require("@/assets/images/default-avatar.png");

interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  profilePicture?: string;
  avatar?: string;
  fullName?: string;
}

interface UserItemProps {
  user: User;
  showOrganizerBadge?: boolean;
  onPress?: (userId: string) => void;
}

export const UserItem = ({
  user,
  showOrganizerBadge = false,
  onPress,
}: UserItemProps) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getFullImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/uploads")) {
      return `${API_BASE_URL}${url}`;
    }
    return `${API_BASE_URL}/${url}`;
  };

  const getProfileImage = () => {
    const profilePic = user.profilePicture;

    if (profilePic && profilePic !== "" && !imageError) {
      const fullUrl = getFullImageUrl(profilePic);
      if (fullUrl) {
        return { uri: fullUrl };
      }
    }
    return DEFAULT_AVATAR;
  };

  const profileImage = getProfileImage();

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handlePress = () => {
    if (onPress) {
      onPress(user._id);
    } else {
      router.push(`/profile/${user._id}`);
    }
  };

  const displayName = user.fullName || user.name;
  const displayUsername =
    user.username || displayName.toLowerCase().replace(/\s/g, "");

  return (
    <TouchableOpacity
      style={styles.userCard}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#8b5cf6" />
          </View>
        )}
        <Image
          source={profileImage}
          style={styles.userAvatarImage}
          onLoad={handleImageLoad}
          onError={handleImageError}
          defaultSource={DEFAULT_AVATAR}
        />
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{displayName}</Text>
        <Text style={styles.userUsername}>@{displayUsername}</Text>
      </View>
      {showOrganizerBadge && (
        <View style={styles.organizerBadge}>
          <Ionicons name="star" size={12} color="#8b5cf6" />
          <Text style={styles.organizerBadgeText}>Organizer</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  userAvatar: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  userAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(243, 232, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  organizerBadge: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  organizerBadgeText: {
    fontSize: 11,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
  },
});

export default UserItem;
