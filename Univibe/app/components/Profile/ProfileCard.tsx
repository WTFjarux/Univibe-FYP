// app/components/Profile/ProfileCard.tsx
import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/AuthContext";
import { API_BASE_URL } from "../../../constants/ipConstants";

// Local default avatar
const DEFAULT_AVATAR: ImageSourcePropType = require("../../../assets/images/default-avatar.png");

interface ProfileCardProps {
  user: {
    _id: string;
    fullName: string;
    username: string;
    profilePicture?: string;
    coverPhoto?: string;
    major?: string;
    year?: string;
    verificationStatus?: string;
    stats?: {
      posts: number;
      connections: number;
      groups: number;
    };
  };
  onPress?: () => void;
  showFollowButton?: boolean;
  isFollowing?: boolean;
  onFollowPress?: () => void;
}

export default function ProfileCard({
  user,
  onPress,
  showFollowButton = false,
  isFollowing = false,
  onFollowPress,
}: ProfileCardProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  // ✅ Add null check for user
  if (!user) {
    return null;
  }

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to profile
      if (user._id === currentUser?.id) {
        router.push("/(tabs)/profile");
      } else {
        router.push(`/profile/${user._id}`);
      }
    }
  };

  const handleFollowPress = (e: any) => {
    e.stopPropagation();
    if (onFollowPress) {
      onFollowPress();
    }
  };

  // Get profile picture source
  const getProfilePictureSource = (): ImageSourcePropType => {
    if (user.profilePicture && user.profilePicture.trim() !== "") {
      let url = user.profilePicture;
      if (url.startsWith("/")) {
        url = `${API_BASE_URL}${url}`;
      }
      return { uri: url };
    }
    return DEFAULT_AVATAR;
  };

  // Get cover photo source (returns ImageSourcePropType or null)
  const getCoverPhotoSource = (): ImageSourcePropType | null => {
    if (user.coverPhoto && user.coverPhoto.trim() !== "") {
      let url = user.coverPhoto;
      if (url.startsWith("/")) {
        url = `${API_BASE_URL}${url}`;
      }
      return { uri: url };
    }
    return null;
  };

  const isOwnProfile = user._id === currentUser?.id;
  const coverPhotoSource = getCoverPhotoSource();

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.card}
      activeOpacity={0.7}
    >
      {/* Cover Photo Section */}
      <View style={styles.coverSection}>
        {coverPhotoSource ? (
          <Image source={coverPhotoSource} style={styles.coverImage} />
        ) : (
          <View style={styles.defaultCover}>
            <Ionicons
              name="image-outline"
              size={48}
              color="rgba(255,255,255,0.7)"
            />
          </View>
        )}
        <Image source={getProfilePictureSource()} style={styles.profileImage} />

        {/* Follow Button Overlay (optional) */}
        {showFollowButton && !isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followOverlayButton,
              isFollowing && styles.followingOverlayButton,
            ]}
            onPress={handleFollowPress}
          >
            <Ionicons
              name={isFollowing ? "checkmark" : "person-add"}
              size={16}
              color={isFollowing ? "#8b5cf6" : "white"}
            />
            <Text
              style={[
                styles.followOverlayText,
                isFollowing && styles.followingOverlayText,
              ]}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {user.fullName}
              </Text>
              {user.verificationStatus === "verified" && (
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color="#10b981"
                  style={styles.verifiedIcon}
                />
              )}
            </View>
            <Text style={styles.username} numberOfLines={1}>
              @{user.username}
            </Text>
            {user.major && user.year && (
              <Text style={styles.details} numberOfLines={1}>
                {user.major} • {user.year}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="chatbubble-outline" size={20} color="#8b5cf6" />
            <Text style={styles.statNumber}>{user.stats?.posts || 0}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={20} color="#3b82f6" />
            <Text style={styles.statNumber}>
              {user.stats?.connections || 0}
            </Text>
            <Text style={styles.statLabel}>Connections</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-circle-outline" size={20} color="#10b981" />
            <Text style={styles.statNumber}>{user.stats?.groups || 0}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  coverSection: {
    height: 100,
    position: "relative",
    backgroundColor: "#f5f3ff",
  },
  coverImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  defaultCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#f1f5f9",
    position: "absolute",
    bottom: -40,
    left: 16,
    zIndex: 2,
  },
  followOverlayButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#8b5cf6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    zIndex: 3,
  },
  followingOverlayButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  followOverlayText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  followingOverlayText: {
    color: "#8b5cf6",
  },
  cardContent: {
    padding: 16,
    paddingTop: 48,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardInfo: {
    marginLeft: 0,
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  name: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  username: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  details: {
    fontSize: 14,
    color: "#374151",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
});
