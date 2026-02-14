import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Post } from "../../../lib/postService";
import { formatTimeAgo } from "../../../lib/formatTime";
import { API_BASE_URL } from "../../../constants/stringConstants";

interface PostCardProps {
  post: Post;
  onLikePress: (postId: string) => void;
  onCommentPress: (postId: string) => void;
  onRepostPress: (postId: string) => void;
  onSharePress: (postId: string) => void;
  onMorePress: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onLikePress,
  onCommentPress,
  onRepostPress,
  onSharePress,
  onMorePress,
}) => {
  // Track loading states for images
  const [avatarError, setAvatarError] = useState(false);
  const [postImageError, setPostImageError] = useState<boolean[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate image dimensions for responsive layout
  const windowWidth = Dimensions.get("window").width;
  const imageWidth = windowWidth - 40; // Account for horizontal padding
  const imageHeight = 400; // Fixed height for consistent card sizing

  // Convert relative API URLs to absolute URLs
  const getFullImageUrl = (url: string): string => {
    if (!url) return "";

    // Return as-is if already absolute URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // Construct full URL from API base path
    const baseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl}${cleanUrl}`;
  };

  // Get user's profile image URL, fallback to generated avatar if needed
  const getProfileImage = (): string => {
    // If post is anonymous, show anonymous avatar
    if (post.isAnonymous) {
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous`;
    }

    if (avatarError || !post.user?.profilePicture) {
      const seed = post.user?.username || "user";
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    }

    return getFullImageUrl(post.user.profilePicture);
  };

  const userImage = getProfileImage();

  // Process post images to ensure they have absolute URLs
  const getPostImages = () => {
    if (!post.images || post.images.length === 0) return [];

    return post.images.map((image) => ({
      ...image,
      url: getFullImageUrl(image.url),
    }));
  };

  const postImages = getPostImages();

  // Initialize error tracking for each post image
  useEffect(() => {
    if (postImages.length > 0) {
      setPostImageError(new Array(postImages.length).fill(false));
    }
  }, [postImages.length]);

  // Mark an image as failed to load
  const handleImageError = (index: number) => {
    const newErrors = [...postImageError];
    newErrors[index] = true;
    setPostImageError(newErrors);
  };

  // Update current image index when user scrolls horizontally
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / imageWidth);
    setCurrentImageIndex(index);
  };

  // Scroll to a specific image in multi-image posts
  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * imageWidth,
        animated: true,
      });
    }
  };

  // Get visibility icon based on post visibility - FIXED: Ensure valid icon names
  const getVisibilityIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (post.visibility) {
      case "campus":
        return "school-outline";
      case "connections":
        return "people-outline";
      case "following":
        return "eye-outline";
      case "private":
        return "lock-closed-outline";
      default:
        return "globe-outline";
    }
  };

  // Get visibility label based on post visibility
  const getVisibilityDisplayName = (): string => {
    switch (post.visibility) {
      case "campus":
        return "Campus";
      case "connections":
        return "Connections";
      case "following":
        return "Following";
      case "private":
        return "Only Me";
      default:
        return "Public";
    }
  };

  // Get color for visibility badge based on type
  const getVisibilityBadgeColor = (): string => {
    switch (post.visibility) {
      case "campus":
        return "#3b82f6"; // Blue
      case "connections":
        return "#8b5cf6"; // Purple
      case "following":
        return "#10b981"; // Green
      case "private":
        return "#6b7280"; // Gray
      default:
        return "#9ca3af"; // Light gray
    }
  };

  // Render navigation dots for multi-image posts
  const renderIndicators = () => {
    if (postImages.length <= 1) return null;

    return (
      <View style={styles.indicatorsContainer}>
        {postImages.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => goToImage(index)}
            style={[
              styles.indicator,
              index === currentImageIndex && styles.activeIndicator,
            ]}
          />
        ))}
      </View>
    );
  };

  // Render single image post
  const renderSingleImage = () => {
    const image = postImages[0];

    if (postImageError[0]) {
      return (
        <View
          style={[
            styles.imageErrorContainer,
            { width: imageWidth, height: imageHeight },
          ]}
        >
          <Ionicons name="image-outline" size={48} color="#9ca3af" />
          <Text style={styles.imageErrorText}>Image failed to load</Text>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: image.url }}
        style={[styles.postImage, { width: imageWidth, height: imageHeight }]}
        resizeMode="cover"
        onError={() => handleImageError(0)}
      />
    );
  };

  // Render swipeable multi-image post
  const renderMultipleImages = () => {
    return (
      <View style={styles.multiImageContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ width: imageWidth }}
        >
          {postImages.map((image, index) => {
            if (postImageError[index]) {
              return (
                <View
                  key={index}
                  style={[
                    styles.imageErrorContainer,
                    { width: imageWidth, height: imageHeight },
                  ]}
                >
                  <Ionicons name="image-outline" size={48} color="#9ca3af" />
                  <Text style={styles.imageErrorText}>
                    Image failed to load
                  </Text>
                </View>
              );
            }

            return (
              <Image
                key={index}
                source={{ uri: image.url }}
                style={[
                  styles.postImage,
                  { width: imageWidth, height: imageHeight },
                ]}
                resizeMode="cover"
                onError={() => handleImageError(index)}
              />
            );
          })}
        </ScrollView>
        {renderIndicators()}
      </View>
    );
  };

  // Get user display name based on anonymity
  const getUserDisplayName = () => {
    if (post.isAnonymous) {
      return "Anonymous";
    }
    return post.user?.name || "User";
  };

  // Get user display handle based on anonymity
  const getUserDisplayHandle = () => {
    if (post.isAnonymous) {
      return "anonymous";
    }
    return post.user?.username || "user";
  };

  // Get the visibility icon name safely
  const visibilityIconName = getVisibilityIconName();

  return (
    <View style={styles.postCard}>
      {/* Post header with user info and actions */}
      <View style={styles.postHeader}>
        {post.isAnonymous ? (
          <View style={[styles.postAvatar, styles.anonymousAvatar]}>
            <Ionicons name="eye-off" size={16} color="#666" />
          </View>
        ) : avatarError ? (
          <View style={[styles.postAvatar, styles.fallbackAvatar]}>
            <Text style={styles.fallbackAvatarText}>
              {post.user?.name?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: userImage }}
            style={styles.postAvatar}
            onError={() => setAvatarError(true)}
          />
        )}
        <View style={styles.postUserInfo}>
          <View style={styles.postUser}>
            <Text style={styles.postUserName}>{getUserDisplayName()}</Text>
            {!post.isAnonymous && post.user?.verified && (
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            )}

            {/* Show anonymous badge if post is anonymous */}
            {post.isAnonymous && (
              <View style={styles.anonymousBadge}>
                <Ionicons name="eye-off" size={12} color="#6b7280" />
                <Text style={styles.anonymousBadgeText}>Anonymous</Text>
              </View>
            )}

            {/* Show visibility badge only for NON-anonymous posts */}
            {!post.isAnonymous && (
              <View
                style={[
                  styles.visibilityBadge,
                  { backgroundColor: `${getVisibilityBadgeColor()}15` }, // 15 = 8% opacity
                ]}
              >
                <Ionicons
                  name={visibilityIconName}
                  size={12}
                  color={getVisibilityBadgeColor()}
                />
                <Text
                  style={[
                    styles.visibilityBadgeText,
                    { color: getVisibilityBadgeColor() },
                  ]}
                >
                  {getVisibilityDisplayName()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.postUserDetails}>
            @{getUserDisplayHandle()} • {formatTimeAgo(post.createdAt)}
          </Text>
        </View>
        <TouchableOpacity onPress={() => onMorePress(post._id)}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Post content text */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post images section */}
      {postImages.length > 0 && (
        <View style={styles.imagesContainer}>
          {postImages.length === 1
            ? renderSingleImage()
            : renderMultipleImages()}

          {/* Image counter for multi-image posts */}
          {postImages.length > 1 && (
            <View style={styles.imageCounter}>
              <Ionicons name="images-outline" size={16} color="white" />
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1}/{postImages.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Post action buttons */}
      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.postAction}
          onPress={() => onLikePress(post._id)}
        >
          <Ionicons
            name={post.isLiked ? "heart" : "heart-outline"}
            size={20}
            color={post.isLiked ? "#ef4444" : "#6b7280"}
          />
          <Text
            style={[styles.postActionText, post.isLiked && styles.likedText]}
          >
            {post.likes?.length || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.postAction}
          onPress={() => onCommentPress(post._id)}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#6b7280" />
          <Text style={styles.postActionText}>
            {post.comments?.length || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.postAction}
          onPress={() => onRepostPress(post._id)}
        >
          <Ionicons
            name={post.isReposted ? "repeat" : "repeat-outline"}
            size={20}
            color={post.isReposted ? "#10b981" : "#6b7280"}
          />
          <Text style={styles.postActionText}>{post.reposts?.length || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.postAction}
          onPress={() => onSharePress(post._id)}
        >
          <Ionicons name="share-outline" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Styles for PostCard component
const styles = StyleSheet.create({
  postCard: {
    backgroundColor: "white",
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#f3f4f6",
  },
  anonymousAvatar: {
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  fallbackAvatar: {
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  postUserInfo: {
    flex: 1,
  },
  postUser: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  postUserDetails: {
    fontSize: 13,
    color: "#6b7280",
  },
  anonymousBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  anonymousBadgeText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#6b7280",
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  visibilityBadgeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  postContent: {
    fontSize: 15,
    lineHeight: 20,
    color: "#374151",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  imagesContainer: {
    position: "relative",
    marginBottom: 12,
  },
  postImage: {
    backgroundColor: "#f3f4f6",
  },
  multiImageContainer: {
    position: "relative",
  },
  indicatorsContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
  },
  activeIndicator: {
    backgroundColor: "#fff",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  imageErrorContainer: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  imageErrorText: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
  },
  imageCounter: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  imageCounterText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  postAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postActionText: {
    fontSize: 14,
    color: "#6b7280",
    minWidth: 24,
  },
  likedText: {
    color: "#ef4444",
  },
});

export default PostCard;
