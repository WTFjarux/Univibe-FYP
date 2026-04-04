import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Post } from "@/lib/postService";
import { formatTimeAgo } from "@/lib/formatTime";
import { getFullImageUrl, formatUserDisplay } from "@/lib/postService";
import { API_BASE_URL } from "@/constants/ipConstants";

const { width: screenWidth } = Dimensions.get("window");
const imageWidth = screenWidth - 32;
const imageHeight = 400;

// Local default avatar
const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");

interface PostPreviewProps {
  post: Post;
  isLiked?: boolean;
  likesCount?: number;
  onLikePress?: () => void;
  onImagePress: (index: number) => void;
}

/**
 * Helper function to get profile image with local default fallback
 */
const getProfileImageSource = (
  imageUrl: string | undefined,
): ImageSourcePropType => {
  if (imageUrl && imageUrl.trim() !== "") {
    let url = imageUrl;
    if (url.startsWith("/")) {
      url = `${API_BASE_URL}${url}`;
    }
    return { uri: url };
  }
  return DEFAULT_AVATAR;
};

const PostPreview: React.FC<PostPreviewProps> = ({
  post,
  isLiked = false,
  likesCount = 0,
  onLikePress,
  onImagePress,
}) => {
  const [avatarError, setAvatarError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isScrollingRef = React.useRef(false);

  const userDisplay = formatUserDisplay(post);
  const postImages = post.images?.map((img) => getFullImageUrl(img.url)) || [];

  const renderPostAvatar = () => {
    if (post.isAnonymous) {
      return (
        <View style={[styles.avatar, styles.anonymousAvatar]}>
          <Ionicons name="eye-off-outline" size={20} color="#9ca3af" />
        </View>
      );
    }

    if (avatarError) {
      return (
        <View style={[styles.avatar, styles.fallbackAvatar]}>
          <Text style={styles.fallbackAvatarText}>
            {userDisplay.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      );
    }

    const profileImageUrl = post.user?.profilePicture || undefined;
    const imageSource = getProfileImageSource(profileImageUrl);

    if (imageSource === DEFAULT_AVATAR) {
      return <Image source={DEFAULT_AVATAR} style={styles.avatar} />;
    }

    return (
      <Image
        source={imageSource}
        style={styles.avatar}
        onError={() => setAvatarError(true)}
      />
    );
  };

  const renderDots = () => {
    if (postImages.length <= 1) return null;

    return (
      <View style={styles.dotContainer}>
        {Array.from({ length: postImages.length }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentImageIndex && styles.activeDot,
            ]}
          />
        ))}
      </View>
    );
  };

  const renderCounter = () => {
    if (postImages.length <= 1) return null;

    return (
      <View style={styles.counterBadge}>
        <Text style={styles.counterText}>
          {currentImageIndex + 1}/{postImages.length}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.postCard}>
      {/* User Info */}
      <View style={styles.userRow}>
        {renderPostAvatar()}
        <View style={styles.userInfo}>
          <View style={styles.nameContainer}>
            <Text style={styles.userName}>{userDisplay.name}</Text>
          </View>
          <Text style={styles.timestamp}>{formatTimeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Post Text */}
      <Text style={styles.postText}>{post.content}</Text>

      {/* Images */}
      {postImages.length > 0 && (
        <View style={styles.imagesWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => {
              isScrollingRef.current = true;
            }}
            onScrollEndDrag={() => {
              isScrollingRef.current = false;
            }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / imageWidth,
              );
              setCurrentImageIndex(index);
              isScrollingRef.current = false;
            }}
            scrollEventThrottle={16}
          >
            {postImages.map((url, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => onImagePress(index)}
                activeOpacity={0.9}
              >
                <Image
                  source={{ uri: url }}
                  style={[
                    styles.image,
                    { width: imageWidth, height: imageHeight },
                  ]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {renderDots()}
          {renderCounter()}
        </View>
      )}

      {/* Stats with Like Button */}
      <View style={styles.stats}>
        <TouchableOpacity
          style={styles.stat}
          onPress={onLikePress}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={18}
            color={isLiked ? "#ef4444" : "#6b7280"}
          />
          <Text style={[styles.statText, isLiked && styles.statTextActive]}>
            {likesCount || 0}
          </Text>
        </TouchableOpacity>

        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={18} color="#6b7280" />
          <Text style={styles.statText}>{post.commentCount || 0}</Text>
        </View>
      </View>

      {/* Comments Header */}
      <View style={styles.commentsHeader}>
        <Text style={styles.commentsTitle}>Comments</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#f3f4f6",
  },
  anonymousAvatar: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  fallbackAvatar: {
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  timestamp: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  postText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#374151",
    marginBottom: 16,
  },
  imagesWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  image: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
  },
  dotContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  counterBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  stats: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: "#6b7280",
  },
  statTextActive: {
    color: "#ef4444",
  },
  commentsHeader: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
});

export default PostPreview;
