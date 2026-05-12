import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { UserSearchResult as UserSearchResultType } from "../../../lib/types/search";
import { getFullImageUrl } from "../../../lib/services/postService";

interface UserSearchResultProps {
  user: UserSearchResultType;
  onConnectionPress?: (userId: string, currentStatus: string) => void;
  connectionLoading?: boolean;
}

const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

/**
 * Get the connection button configuration based on status
 */
const getConnectionConfig = (status: string) => {
  switch (status) {
    case "connected":
      return {
        label: "Connected",
        icon: "checkmark-circle" as const,
        color: "#10b981",
        bgColor: "#f0fdf4",
      };
    case "pending_sent":
      return {
        label: "Requested",
        icon: "time-outline" as const,
        color: "#f59e0b",
        bgColor: "#fffbeb",
      };
    case "pending_received":
      return {
        label: "Accept",
        icon: "person-add-outline" as const,
        color: "#8b5cf6",
        bgColor: "#f5f3ff",
      };
    default:
      return {
        label: "Connect",
        icon: "person-add-outline" as const,
        color: "#8b5cf6",
        bgColor: "#f5f3ff",
      };
  }
};

/**
 * User search result card component.
 *
 * Features:
 * - Profile picture with fallback
 * - Name, username, bio snippet
 * - Verified badge
 * - Connection status button
 * - Navigates to profile on tap
 */
export const UserSearchResult: React.FC<UserSearchResultProps> = ({
  user,
  onConnectionPress,
  connectionLoading = false,
}) => {
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);
  const config = getConnectionConfig(user.connectionStatus);

  const handlePress = () => {
    router.push(`/profile/${user.user._id}`);
  };

  const handleConnectionPress = (e: any) => {
    e.stopPropagation();
    if (onConnectionPress) {
      onConnectionPress(user.user._id, user.connectionStatus);
    }
  };

  const getAvatarSource = () => {
    if (user.profilePicture && !avatarError) {
      return { uri: getFullImageUrl(user.profilePicture) };
    }
    return DEFAULT_AVATAR;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Image
          source={getAvatarSource()}
          style={styles.avatar}
          onError={() => setAvatarError(true)}
        />
        {/* Online indicator placeholder - can be wired up later */}
        {/* <View style={styles.onlineIndicator} /> */}
      </View>

      {/* User Info */}
      <View style={styles.infoContainer}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {user.fullName}
          </Text>
          {user.verified && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color="#8b5cf6"
              style={styles.verifiedBadge}
            />
          )}
        </View>

        <Text style={styles.username} numberOfLines={1}>
          @{user.username}
        </Text>

        {user.bio ? (
          <Text style={styles.bio} numberOfLines={1}>
            {user.bio}
          </Text>
        ) : (
          <Text style={styles.meta}>
            {[user.major, user.year, user.campus].filter(Boolean).join(" • ")}
          </Text>
        )}
      </View>

      {/* Connection Button */}
      <TouchableOpacity
        style={[styles.connectionButton, { backgroundColor: config.bgColor }]}
        onPress={handleConnectionPress}
        disabled={connectionLoading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name={config.icon} size={16} color={config.color} />
        <Text style={[styles.connectionButtonText, { color: config.color }]}>
          {config.label}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontSize: 15,
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  username: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    marginTop: 1,
  },
  bio: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  connectionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  connectionButtonText: {
    fontSize: 12,
    fontFamily: "SofiaSans-Bold",
  },
});

export default UserSearchResult;
