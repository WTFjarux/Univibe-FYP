// app/components/Feed/Comment/PostPreview.tsx
import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import {
  Post,
  getFullImageUrl,
  formatUserDisplay,
} from "@/lib/services/postService";
import { formatTimeAgo } from "@/lib/utils/formatTime";
import BlurhashImage from "@/app/components/BlurhashImage";
import SharePostModal from "@/app/components/Feed/Post/SharePostModal";

const { width: screenWidth } = Dimensions.get("window");
const IMAGE_WIDTH = screenWidth - 32;

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface PostPreviewProps {
  post: Post;
  isLiked: boolean;
  likesCount: number;
  onLikePress: () => void;
  onImagePress: (index: number) => void;
}

const PostPreview: React.FC<PostPreviewProps> = ({
  post,
  isLiked,
  likesCount,
  onLikePress,
  onImagePress,
}) => {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [avatarError, setAvatarError] = useState(false);
  const [postImageError, setPostImageError] = useState<boolean[]>([]);
  const [containerWidth, setContainerWidth] = useState(IMAGE_WIDTH);
  const scrollViewRef = useRef<ScrollView>(null);

  // Share modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const userDisplay = formatUserDisplay(post);
  const postImages = post.images?.map((img) => getFullImageUrl(img.url)) || [];

  // Initialize image error array
  React.useEffect(() => {
    if (postImages.length > 0) {
      setPostImageError(new Array(postImages.length).fill(false));
    }
  }, [postImages.length]);

  // Handle profile navigation
  const handleProfilePress = useCallback(() => {
    if (post.isAnonymous) return;
    const userId = post.user?._id?.toString();
    if (!userId) return;
    if (userId === currentUser?.id?.toString()) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/profile/${userId}`);
    }
  }, [post.isAnonymous, post.user?._id, currentUser?.id, router]);

  // Handle image scroll
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const contentOffsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffsetX / containerWidth);
      setCurrentImageIndex(index);
    },
    [containerWidth],
  );

  // Handle image error
  const handleImageError = useCallback((index: number) => {
    setPostImageError((prev) => {
      const newErrors = [...prev];
      newErrors[index] = true;
      return newErrors;
    });
  }, []);

  // Go to specific image
  const goToImage = useCallback(
    (index: number) => {
      setCurrentImageIndex(index);
      if (scrollViewRef.current && containerWidth > 0) {
        scrollViewRef.current.scrollTo({
          x: index * containerWidth,
          animated: true,
        });
      }
    },
    [containerWidth],
  );

  // Share handler
  const handleSharePress = useCallback(() => {
    setShareModalVisible(true);
  }, []);

  const handleShareClose = useCallback(() => {
    setShareModalVisible(false);
  }, []);

  const handleShareSuccess = useCallback((data: any) => {
    Alert.alert("Shared", "Post shared successfully!");
  }, []);

  // ─── Visibility Badge Helpers (Same as PostCard) ───
  const getVisibilityIconName = useCallback((): IconName => {
    const icons: Record<string, IconName> = {
      campus: "school-outline",
      connections: "people-outline",
    };
    return icons[post.visibility] || "globe-outline";
  }, [post.visibility]);

  const getVisibilityDisplayName = useCallback((): string => {
    const names: Record<string, string> = {
      campus: "Campus",
      connections: "Connections",
    };
    return names[post.visibility] || "Public";
  }, [post.visibility]);

  const getVisibilityBadgeColor = useCallback((): string => {
    const customColors: Record<string, string> = {
      campus: "#3b82f6",
      connections: colors.primary,
    };
    return customColors[post.visibility] || colors.textMuted;
  }, [post.visibility, colors.primary, colors.textMuted]);

  // Render avatar (same logic as PostCard)
  const renderAvatar = () => {
    const avatarSize = 40;

    // Anonymous post
    if (post.isAnonymous) {
      return (
        <View
          style={[
            styles.avatar,
            styles.anonymousAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: colors.border,
              borderColor: colors.textMuted,
            },
          ]}
        >
          <Ionicons name="eye-off-outline" size={20} color={colors.textMuted} />
        </View>
      );
    }

    // Has profile picture and no error
    if (post.user?.profilePicture && !avatarError) {
      return (
        <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.7}>
          <BlurhashImage
            uri={getFullImageUrl(post.user.profilePicture)}
            style={[
              styles.avatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
                backgroundColor: colors.border,
              },
            ]}
            transition={200}
            onError={() => setAvatarError(true)}
          />
        </TouchableOpacity>
      );
    }

    // Fallback avatar with initials
    return (
      <TouchableOpacity onPress={handleProfilePress} activeOpacity={0.7}>
        <View
          style={[
            styles.avatar,
            styles.fallbackAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: colors.primary,
            },
          ]}
        >
          <Text style={styles.fallbackAvatarText}>
            {userDisplay.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Render image indicators (dots)
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

  // Render image counter
  const renderCounter = () => {
    if (postImages.length <= 1) return null;
    return (
      <View style={styles.imageCounter}>
        <Ionicons name="images-outline" size={14} color="white" />
        <Text style={styles.imageCounterText}>
          {currentImageIndex + 1}/{postImages.length}
        </Text>
      </View>
    );
  };

  const visibilityIconName = getVisibilityIconName();
  const visibilityBadgeColor = getVisibilityBadgeColor();

  // Prepare share data
  const sharePostData = {
    postId: post._id,
    postContent: post.content || "",
    postImage: post.images?.[0]?.url
      ? getFullImageUrl(post.images[0].url)
      : undefined,
    postAuthorName: post.isAnonymous
      ? "Anonymous"
      : post.user?.name || "Unknown",
    postAuthorAvatar: post.user?.profilePicture
      ? getFullImageUrl(post.user.profilePicture)
      : undefined,
    isAnonymous: post.isAnonymous || false,
  };

  // Dynamic Theme Mapping Matrix
  const dynamicStyles = {
    container: {
      backgroundColor: colors.card,
      borderBottomColor: colors.border,
    },
    userName: {
      color: colors.text,
    },
    timestamp: {
      color: colors.textSecondary,
    },
    content: {
      color: colors.text,
    },
    imageErrorContainer: {
      backgroundColor: colors.border,
    },
    imageErrorText: {
      color: colors.textSecondary,
    },
    postImage: {
      backgroundColor: colors.border,
    },
    actions: {
      borderTopColor: colors.border,
    },
    actionText: {
      color: colors.textSecondary,
    },
    commentsHeader: {
      borderTopColor: colors.border,
    },
    commentsTitle: {
      color: colors.text,
    },
  };

  return (
    <>
      <View
        style={[styles.container, dynamicStyles.container]}
        onLayout={(event) => {
          setContainerWidth(event.nativeEvent.layout.width);
        }}
      >
        {/* Header - Same as PostCard with visibility badge */}
        <View style={styles.header}>
          {renderAvatar()}

          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <TouchableOpacity
                onPress={handleProfilePress}
                disabled={post.isAnonymous}
                activeOpacity={0.7}
              >
                <Text style={[styles.userName, dynamicStyles.userName]}>
                  {userDisplay.name}
                </Text>
              </TouchableOpacity>

              {/* VISIBILITY BADGE */}
              <View
                style={[
                  styles.visibilityBadge,
                  { backgroundColor: `${visibilityBadgeColor}15` },
                ]}
              >
                <Ionicons
                  name={visibilityIconName}
                  size={12}
                  color={visibilityBadgeColor}
                />
                <Text
                  style={[
                    styles.visibilityBadgeText,
                    { color: visibilityBadgeColor },
                  ]}
                >
                  {getVisibilityDisplayName()}
                </Text>
              </View>
            </View>
            <Text style={[styles.timestamp, dynamicStyles.timestamp]}>
              @{post.isAnonymous ? "anonymous" : post.user?.username || "user"}{" "}
              • {formatTimeAgo(post.createdAt)}
            </Text>
          </View>
        </View>

        {/* Post Content */}
        {post.content ? (
          <Text style={[styles.content, dynamicStyles.content]}>
            {post.content}
          </Text>
        ) : null}

        {/* Post Images */}
        {postImages.length > 0 && (
          <View style={styles.imagesWrapper}>
            {postImages.length === 1 ? (
              // Single image
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => onImagePress(0)}
              >
                {postImageError[0] ? (
                  <View
                    style={[
                      styles.imageErrorContainer,
                      dynamicStyles.imageErrorContainer,
                      { width: containerWidth, height: 400 },
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={48}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.imageErrorText,
                        dynamicStyles.imageErrorText,
                      ]}
                    >
                      Image failed to load
                    </Text>
                  </View>
                ) : (
                  <BlurhashImage
                    uri={postImages[0]}
                    style={[
                      styles.postImage,
                      dynamicStyles.postImage,
                      { width: containerWidth, height: 400 },
                    ]}
                    transition={300}
                    recyclingKey={postImages[0]}
                    onError={() => handleImageError(0)}
                  />
                )}
              </TouchableOpacity>
            ) : (
              // Multiple images carousel
              <View>
                <ScrollView
                  ref={scrollViewRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                >
                  {postImages.map((url, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.95}
                      onPress={() => onImagePress(index)}
                    >
                      {postImageError[index] ? (
                        <View
                          style={[
                            styles.imageErrorContainer,
                            dynamicStyles.imageErrorContainer,
                            { width: containerWidth, height: 400 },
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={48}
                            color={colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.imageErrorText,
                              dynamicStyles.imageErrorText,
                            ]}
                          >
                            Image failed to load
                          </Text>
                        </View>
                      ) : (
                        <BlurhashImage
                          uri={url}
                          style={[
                            styles.postImage,
                            dynamicStyles.postImage,
                            { width: containerWidth, height: 400 },
                          ]}
                          transition={300}
                          recyclingKey={url}
                          onError={() => handleImageError(index)}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {renderIndicators()}
                {renderCounter()}
              </View>
            )}
          </View>
        )}

        {/* Post Actions */}
        <View style={[styles.actions, dynamicStyles.actions]}>
          {/* Like Button */}
          <TouchableOpacity
            style={styles.action}
            onPress={onLikePress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={20}
              color={isLiked ? "#ef4444" : colors.textSecondary}
            />
            <Text
              style={[
                styles.actionText,
                dynamicStyles.actionText,
                isLiked && styles.actionTextLiked,
              ]}
            >
              {likesCount || 0}
            </Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <View style={styles.action}>
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={[styles.actionText, dynamicStyles.actionText]}>
              {post.commentCount || 0}
            </Text>
          </View>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.action}
            onPress={handleSharePress}
            activeOpacity={0.7}
          >
            <Ionicons
              name="share-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Comments Header */}
        <View style={[styles.commentsHeader, dynamicStyles.commentsHeader]}>
          <Text style={[styles.commentsTitle, dynamicStyles.commentsTitle]}>
            Comments
          </Text>
        </View>
      </View>

      {/* Share Modal */}
      <SharePostModal
        visible={shareModalVisible}
        onClose={handleShareClose}
        onSuccess={handleShareSuccess}
        {...sharePostData}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    borderBottomWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  avatar: {
    marginRight: 12,
  },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  fallbackAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackAvatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
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
    fontFamily: "SofiaSans-Regular",
  },
  timestamp: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
  },
  content: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 20,
    fontFamily: "SofiaSans-Regular",
  },
  imagesWrapper: {
    marginBottom: 12,
  },
  postImage: {},
  imageErrorContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  imageErrorText: {
    fontSize: 14,
    marginTop: 8,
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
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 0,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  actionTextLiked: {
    color: "#ef4444",
  },
  commentsHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
});

export default React.memo(PostPreview);
