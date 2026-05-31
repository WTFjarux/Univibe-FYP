// app/components/Feed/Post/PostCard.tsx

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ImageSourcePropType,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import BlurhashImage from "@/app/components/BlurhashImage";
import { Post, getFullImageUrl } from "@/lib/services/postService";
import { formatTimeAgo } from "@/lib/utils/formatTime";
import PostOptionsModal from "./PostOptionsModal";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { commentEvents, EVENTS } from "@/lib/utils/eventEmitter";

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface PostCardProps {
  post: Post;
  compact?: boolean;
  disableNavigation?: boolean;
  hideActions?: boolean;
  hideTime?: boolean;
  onImagePress?: (index: number) => void;
  onLikePress: (postId: string) => void;
  onCommentPress: (postId: string) => void;
  onSharePress: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onUnhide?: (postId: string) => void;
  isHidden?: boolean;
  onCopyLink?: (postId: string) => void;
  onMuteUser?: (userId: string, userName?: string) => void;
  onUnmuteUser?: (userId: string, userName?: string) => void;
  isMuted?: boolean;
  onBlockUser?: (userId: string, userName?: string) => void;
  onUnblockUser?: (userId: string, userName?: string) => void;
  isBlocked?: boolean;
  onProfilePress?: (userId: string) => void;
  onOptionsOpen?: () => void;
  onOptionsClose?: () => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  compact = false,
  disableNavigation = false,
  hideActions = false,
  hideTime = false,
  onImagePress,
  onLikePress,
  onCommentPress,
  onSharePress,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onHide,
  onUnhide,
  isHidden = false,
  onCopyLink,
  onMuteUser,
  onUnmuteUser,
  isMuted = false,
  onBlockUser,
  onUnblockUser,
  isBlocked = false,
  onProfilePress,
  onOptionsOpen,
  onOptionsClose,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { colors } = useTheme();

  // Check if this is a community post
  const isCommunityPost = !!post.community?.name;

  // ===== State Management =====
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isReported, setIsReported] = useState(post.isReported || false);
  const [localIsHidden, setLocalIsHidden] = useState(isHidden);
  const [localIsMuted, setLocalIsMuted] = useState(isMuted);
  const [localIsBlocked, setLocalIsBlocked] = useState(isBlocked);
  const [avatarError, setAvatarError] = useState(false);
  const [postImageError, setPostImageError] = useState<boolean[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const [displayCommentCount, setDisplayCommentCount] = useState(
    post.commentCount || 0,
  );
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likesCount, setLikesCount] = useState(
    post.likeCount ?? post.likes?.length ?? 0,
  );

  const scrollViewRef = useRef<ScrollView>(null);
  const imageHeight = compact ? 160 : 400;

  if (!post) {
    console.warn("PostCard: post is null or undefined");
    return null;
  }

  // ===== Sync with Post Props =====
  useEffect(() => {
    setDisplayCommentCount(post.commentCount || 0);
  }, [post.commentCount]);

  useEffect(() => {
    setIsLiked(post.isLiked || false);
    setLikesCount(post.likeCount ?? post.likes?.length ?? 0);
    setIsSaved(post.isSaved || false);
  }, [post.isLiked, post.likeCount, post.likes?.length, post.isSaved]);

  useEffect(() => {
    setLocalIsHidden(isHidden);
  }, [isHidden]);

  useEffect(() => {
    setLocalIsMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    setLocalIsBlocked(isBlocked);
  }, [isBlocked]);

  useEffect(() => {
    setIsReported(post.isReported || false);
  }, [post.isReported]);

  // ===== Event Listeners =====
  useEffect(() => {
    const unsubComments = commentEvents.on(
      EVENTS.COMMENT_COUNT_CHANGED,
      (data: { postId: string; count: number }) => {
        if (data.postId === post._id) {
          setDisplayCommentCount(data.count);
        }
      },
    );
    return () => {
      if (typeof unsubComments === "function") {
        unsubComments();
      }
    };
  }, [post._id]);

  // ===== Image Error Handling =====
  useEffect(() => {
    if (post.images?.length > 0) {
      setPostImageError(new Array(post.images.length).fill(false));
    }
  }, [post.images?.length]);

  const handleImageError = useCallback((index: number) => {
    setPostImageError((prev) => {
      const newErrors = [...prev];
      newErrors[index] = true;
      return newErrors;
    });
  }, []);

  // ===== User Identification =====
  const currentUserId = useMemo(() => {
    if (user?.id) return String(user.id);
    if (profile?.user?._id) return String(profile.user._id);
    if (profile?._id) return String(profile._id);
    return null;
  }, [user, profile]);

  const isOwnPost = useCallback((): boolean => {
    if (post.isAnonymous && post.originalUser) {
      return currentUserId === String(post.originalUser._id);
    }
    return currentUserId === String(post.user?._id ?? "");
  }, [currentUserId, post.isAnonymous, post.originalUser, post.user]);

  const ownPost = isOwnPost();

  const getDisplayName = useCallback((): string => {
    if (isCommunityPost) return post.community!.name;
    if (post.isAnonymous) return "Anonymous";
    return post.user?.name || "User";
  }, [isCommunityPost, post.community, post.isAnonymous, post.user?.name]);

  const getDisplayUsername = useCallback((): string => {
    if (isCommunityPost) return post.community!.name;
    if (post.isAnonymous) return "anonymous";
    return post.user?.username || "user";
  }, [isCommunityPost, post.community, post.isAnonymous, post.user?.username]);

  const getUserIdForNavigation = useCallback((): string | null => {
    if (isCommunityPost) return null; // Community posts don't navigate to user profile
    if (post.isAnonymous && post.originalUser) {
      return String(post.originalUser._id);
    }
    return post.user?._id ? String(post.user._id) : null;
  }, [isCommunityPost, post.isAnonymous, post.originalUser, post.user]);

  // ===== Image Handling =====
  const postImages = useMemo(() => {
    if (!post.images?.length) return [];
    return post.images.map((image) => ({
      ...image,
      url: getFullImageUrl(image.url),
    }));
  }, [post.images]);

  // ===== Navigation =====
  const isAlreadyOnPostDetail = pathname === "/post/[id]";

  const handlePostNavigation = useCallback(() => {
    if (disableNavigation || isAlreadyOnPostDetail) return;
    router.push({ pathname: "/post/[id]", params: { id: post._id } });
  }, [disableNavigation, isAlreadyOnPostDetail, post._id, router]);

  const handleUserPress = useCallback(() => {
    if (isCommunityPost) return; // Don't navigate for community posts
    try {
      const userId = getUserIdForNavigation();
      if (!userId) return;
      if (onProfilePress) {
        onProfilePress(userId);
      } else if (userId === currentUserId) {
        router.push("/(tabs)/profile");
      } else {
        router.push(`/profile/${userId}`);
      }
    } catch (error) {
      console.error("Navigation error in PostCard:", error);
    }
  }, [
    isCommunityPost,
    currentUserId,
    getUserIdForNavigation,
    onProfilePress,
    router,
  ]);

  const handleCommunityPress = useCallback(() => {
    if (!isCommunityPost || !post.community?._id) return;
    router.push(
      `/screens/CommunityScreen?communityId=${post.community._id}` as any,
    );
  }, [isCommunityPost, post.community?._id, router]);

  // ===== Image Carousel =====
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      if (containerWidth > 0) {
        setCurrentImageIndex(Math.round(offsetX / containerWidth));
      }
    },
    [containerWidth],
  );

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

  // ===== Action Handlers =====
  const handleMorePress = useCallback(() => {
    setOptionsVisible(true);
    onOptionsOpen?.();
  }, [onOptionsOpen]);

  const handleOptionsClose = useCallback(() => {
    setOptionsVisible(false);
    onOptionsClose?.();
  }, [onOptionsClose]);

  const postData = useMemo(
    () => ({
      postId: post._id,
      isOwnPost: ownPost,
      isSaved,
      isReported,
      isHidden: localIsHidden,
      isMuted: localIsMuted,
      isBlocked: localIsBlocked,
      userId: post.user?._id ?? undefined,
      userName: getDisplayName(),
    }),
    [
      post._id,
      post.user?._id,
      ownPost,
      isSaved,
      isReported,
      localIsHidden,
      localIsMuted,
      localIsBlocked,
      getDisplayName,
    ],
  );

  // ===== RENDER: Indicators =====
  const renderIndicators = useCallback(() => {
    if (postImages.length <= 1) return null;
    return (
      <View style={styles.indicatorsContainer}>
        {postImages.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={(e) => {
              e.stopPropagation();
              goToImage(index);
            }}
            style={[
              styles.indicator,
              index === currentImageIndex && styles.activeIndicator,
            ]}
          />
        ))}
      </View>
    );
  }, [postImages, currentImageIndex, goToImage]);

  // ===== RENDER: Single Image =====
  const renderSingleImage = useCallback(() => {
    if (containerWidth === 0) return null;
    const image = postImages[0];

    if (postImageError[0]) {
      return (
        <View
          style={[
            styles.imageErrorContainer,
            { width: containerWidth, height: imageHeight },
          ]}
        >
          <Ionicons
            name="image-outline"
            size={compact ? 32 : 48}
            color="#9ca3af"
          />
          <Text style={styles.imageErrorText}>Image failed to load</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity activeOpacity={0.95} onPress={() => onImagePress?.(0)}>
        <BlurhashImage
          uri={image.url}
          style={[
            styles.postImage,
            { width: containerWidth, height: imageHeight },
          ]}
          transition={300}
          recyclingKey={image.url}
          onError={() => handleImageError(0)}
        />
      </TouchableOpacity>
    );
  }, [
    containerWidth,
    postImages,
    postImageError,
    imageHeight,
    compact,
    handleImageError,
    onImagePress,
  ]);

  // ===== RENDER: Multiple Images =====
  const renderMultipleImages = useCallback(() => {
    if (containerWidth === 0) return null;
    return (
      <View style={styles.multiImageContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          nestedScrollEnabled={true}
          style={{ width: containerWidth }}
        >
          {postImages.map((image, index) => {
            if (postImageError[index]) {
              return (
                <View
                  key={index}
                  style={[
                    styles.imageErrorContainer,
                    { width: containerWidth, height: imageHeight },
                  ]}
                >
                  <Ionicons
                    name="image-outline"
                    size={compact ? 32 : 48}
                    color="#9ca3af"
                  />
                  <Text style={styles.imageErrorText}>
                    Image failed to load
                  </Text>
                </View>
              );
            }
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.95}
                onPress={() => onImagePress?.(index)}
              >
                <BlurhashImage
                  uri={image.url}
                  style={[
                    styles.postImage,
                    { width: containerWidth, height: imageHeight },
                  ]}
                  transition={300}
                  recyclingKey={image.url}
                  onError={() => handleImageError(index)}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {renderIndicators()}
      </View>
    );
  }, [
    containerWidth,
    postImages,
    postImageError,
    imageHeight,
    compact,
    handleScroll,
    handleImageError,
    renderIndicators,
    onImagePress,
  ]);

  // ===== RENDER: Avatar =====
  const renderAvatar = useCallback(() => {
    const avatarSize = compact ? 28 : 40;

    // Community post avatar
    if (isCommunityPost) {
      if (post.community?.coverImage) {
        return (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleCommunityPress();
            }}
            disabled={compact}
          >
            <Image
              source={{ uri: getFullImageUrl(post.community.coverImage) }}
              style={[
                styles.postAvatar,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
            />
          </TouchableOpacity>
        );
      }
      return (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleCommunityPress();
          }}
          disabled={compact}
        >
          <View
            style={[
              styles.postAvatar,
              styles.communityAvatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          >
            <Ionicons name="people" size={compact ? 14 : 20} color="#ffffff" />
          </View>
        </TouchableOpacity>
      );
    }

    // Anonymous post avatar
    if (post.isAnonymous) {
      return (
        <View
          style={[
            styles.postAvatar,
            styles.anonymousAvatar,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
        >
          <Ionicons
            name="eye-off-outline"
            size={compact ? 14 : 20}
            color="#9ca3af"
          />
        </View>
      );
    }

    // User avatar
    if (post.user) {
      if (post.user.profilePicture && !avatarError) {
        return (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleUserPress();
            }}
            disabled={compact}
          >
            <BlurhashImage
              uri={getFullImageUrl(post.user.profilePicture)}
              style={[
                styles.postAvatar,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                },
              ]}
              transition={200}
              onError={() => setAvatarError(true)}
            />
          </TouchableOpacity>
        );
      }

      return (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            handleUserPress();
          }}
          disabled={compact}
        >
          <View
            style={[
              styles.postAvatar,
              styles.defaultAvatar,
              {
                width: avatarSize,
                height: avatarSize,
                borderRadius: avatarSize / 2,
              },
            ]}
          >
            <Text
              style={[styles.defaultAvatarText, compact && { fontSize: 12 }]}
            >
              {post.user.name?.charAt(0)?.toUpperCase() || "U"}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Default avatar
    return (
      <View
        style={[
          styles.postAvatar,
          styles.defaultAvatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        <Text style={[styles.defaultAvatarText, compact && { fontSize: 12 }]}>
          U
        </Text>
      </View>
    );
  }, [
    isCommunityPost,
    post.isAnonymous,
    post.user,
    avatarError,
    compact,
    handleUserPress,
  ]);

  // ===== MAIN RENDER =====
  return (
    <View
      style={[
        styles.postCard,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        compact && [styles.compactPostCard, { borderColor: colors.border }],
      ]}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {/* Post Header */}
      <View style={[styles.postHeader, compact && styles.compactPostHeader]}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            if (isCommunityPost) {
              handleCommunityPress();
            } else {
              handleUserPress();
            }
          }}
          disabled={compact}
        >
          {renderAvatar()}
        </Pressable>

        <View style={styles.postUserInfo}>
          <View style={styles.postUser}>
            {isCommunityPost ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleCommunityPress();
                }}
              >
                <Text
                  style={[
                    styles.postUserName,
                    { color: colors.text },
                    compact && styles.compactUserName,
                  ]}
                >
                  {getDisplayName()}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleUserPress();
                }}
                disabled={compact || post.isAnonymous}
              >
                <Text
                  style={[
                    styles.postUserName,
                    { color: colors.text },
                    compact && styles.compactUserName,
                  ]}
                >
                  {getDisplayName()}
                </Text>
              </Pressable>
            )}
            {post.user?.verified && !compact && !isCommunityPost && (
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
            )}
            {/* ✅ Visibility badge for ALL posts */}
            {!compact && (
              <View
                style={[
                  styles.visibilityBadge,
                  {
                    backgroundColor: `${visibilityBadgeColor[post.visibility] || "#9ca3af"}15`,
                  },
                ]}
              >
                <Ionicons
                  name={visibilityIconName[post.visibility] || "globe-outline"}
                  size={12}
                  color={visibilityBadgeColor[post.visibility] || "#9ca3af"}
                />
                <Text
                  style={[
                    styles.visibilityBadgeText,
                    {
                      color: visibilityBadgeColor[post.visibility] || "#9ca3af",
                    },
                  ]}
                >
                  {visibilityDisplayName[post.visibility] || "Public"}
                </Text>
              </View>
            )}
          </View>
          <Pressable onPress={handlePostNavigation}>
            <Text
              style={[
                styles.postUserDetails,
                { color: colors.textSecondary },
                compact && styles.compactUserDetails,
              ]}
            >
              {isCommunityPost
                ? `${formatTimeAgo(post.createdAt)}`
                : `@${post.isAnonymous ? "anonymous" : post.user?.username || "user"}${!hideTime ? ` • ${formatTimeAgo(post.createdAt)}` : ""}`}
            </Text>
          </Pressable>
        </View>

        {!compact && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleMorePress();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Post Content */}
      {!compact && post.content ? (
        <Pressable onPress={handlePostNavigation}>
          <Text style={[styles.postContent, { color: colors.text }]}>
            {post.content}
          </Text>
        </Pressable>
      ) : compact && post.content ? (
        <Pressable onPress={handlePostNavigation}>
          <Text
            style={[styles.compactPostContent, { color: colors.text }]}
            numberOfLines={2}
          >
            {post.content}
          </Text>
        </Pressable>
      ) : null}

      {/* Post Images */}
      {postImages.length > 0 && containerWidth > 0 && (
        <View style={[styles.imagesContainer, compact && { marginBottom: 0 }]}>
          {postImages.length === 1
            ? renderSingleImage()
            : renderMultipleImages()}
          {postImages.length > 1 && !compact && (
            <View style={styles.imageCounter}>
              <Ionicons name="images-outline" size={16} color="white" />
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1}/{postImages.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Post Actions */}
      {!hideActions && (
        <View
          style={[
            styles.postActions,
            { borderTopColor: colors.border },
            compact && styles.compactPostActions,
          ]}
        >
          <TouchableOpacity
            style={styles.postAction}
            onPress={(e) => {
              e.stopPropagation();
              onLikePress(post._id);
            }}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={compact ? 16 : 20}
              color={isLiked ? "#ef4444" : colors.textSecondary}
            />
            <Text
              style={[
                styles.postActionText,
                { color: colors.textSecondary },
                isLiked && styles.likedText,
                compact && styles.compactActionText,
              ]}
            >
              {likesCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postAction}
            onPress={(e) => {
              e.stopPropagation();
              onCommentPress(post._id);
            }}
          >
            <Ionicons
              name="chatbubble-outline"
              size={compact ? 16 : 20}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.postActionText,
                { color: colors.textSecondary },
                compact && styles.compactActionText,
              ]}
            >
              {displayCommentCount}
            </Text>
          </TouchableOpacity>
          {!compact && (
            <TouchableOpacity
              style={styles.postAction}
              onPress={(e) => {
                e.stopPropagation();
                onSharePress(post._id);
              }}
            >
              <Ionicons
                name="share-outline"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Post Options Modal */}
      {!compact && (
        <PostOptionsModal
          visible={optionsVisible}
          onClose={handleOptionsClose}
          postData={postData}
          onEdit={onEdit || (() => {})}
          onDelete={onDelete || (() => {})}
          onSave={onSave || (() => {})}
          onReport={onReport || (() => {})}
          onShare={onSharePress}
          onCopyLink={onCopyLink || (() => {})}
          onHide={localIsHidden ? onUnhide || (() => {}) : onHide || (() => {})}
          onMuteUser={onMuteUser || (() => {})}
          onBlockUser={onBlockUser || (() => {})}
        />
      )}
    </View>
  );
};

// ===== Visibility Helpers =====
const visibilityIconName: Record<string, IconName> = {
  campus: "school-outline",
  connections: "people-outline",
  community: "people",
};

const visibilityDisplayName: Record<string, string> = {
  campus: "Campus",
  connections: "Connections",
  community: "Community",
};

const visibilityBadgeColor: Record<string, string> = {
  campus: "#3b82f6",
  connections: "#8b5cf6",
  community: "#7c3aed",
};

// ===== Styles =====
const styles = StyleSheet.create({
  postCard: {
    backgroundColor: "white",
    marginBottom: 8,
    borderRadius: 0,
    overflow: "hidden",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  compactPostCard: {
    marginBottom: 0,
    borderRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    width: "100%",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingTop: 25,
  },
  compactPostHeader: {
    paddingHorizontal: 10,
    paddingTop: 10,
    marginBottom: 10,
  },
  postAvatar: {
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
  communityAvatar: {
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  postUserInfo: { flex: 1 },
  postUser: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 2,
  },
  postUserName: {
    fontSize: 15,
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  compactUserName: { fontSize: 13 },
  postUserDetails: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  compactUserDetails: { fontSize: 11 },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  visibilityBadgeText: { fontSize: 10, fontFamily: "SofiaSans-Regular" },
  communityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 4,
  },
  communityBadgeText: {
    fontSize: 11,
    fontFamily: "SofiaSans-SemiBold",
  },
  postContent: {
    fontSize: 15,
    lineHeight: 20,
    color: "#374151",
    marginBottom: 12,
    paddingHorizontal: 20,
    fontFamily: "SofiaSans-Regular",
  },
  compactPostContent: {
    fontSize: 12,
    lineHeight: 16,
    color: "#374151",
    marginBottom: 6,
    paddingHorizontal: 10,
    fontFamily: "SofiaSans-Regular",
  },
  imagesContainer: { position: "relative", marginBottom: 12 },
  postImage: { backgroundColor: "#f3f4f6" },
  multiImageContainer: { position: "relative" },
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
  imageErrorText: { color: "#9ca3af", fontSize: 14, marginTop: 8 },
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
  imageCounterText: { color: "white", fontSize: 12 },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 50,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  compactPostActions: { paddingHorizontal: 10, paddingVertical: 6, gap: 16 },
  postAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  postActionText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
    minWidth: 24,
  },
  compactActionText: { fontSize: 11 },
  likedText: { color: "#ef4444" },
  defaultAvatar: {
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultAvatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
});

export default React.memo(PostCard);
