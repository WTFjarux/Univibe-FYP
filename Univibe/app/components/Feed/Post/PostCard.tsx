// app/components/Feed/Post/PostCard.tsx
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
  Alert,
  ImageSourcePropType,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Post } from "../../../../lib/postService";
import { formatTimeAgo } from "../../../../lib/formatTime";
import { API_BASE_URL } from "../../../../constants/stringConstants";
import PostOptionsModal from "./PostOptionsModal";
import { useAuth } from "../../../../lib/AuthContext";

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface PostCardProps {
  post: Post;
  onLikePress: (postId: string) => void;
  onCommentPress: (postId: string) => void;
  onRepostPress: (postId: string) => void;
  onSharePress: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onCopyLink?: (postId: string) => void;
  onMuteUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onLikePress,
  onCommentPress,
  onRepostPress,
  onSharePress,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onHide,
  onCopyLink,
  onMuteUser,
  onBlockUser,
}) => {
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isReported, setIsReported] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [postImageError, setPostImageError] = useState<boolean[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);
  const { user, profile } = useAuth();

  const windowWidth = Dimensions.get("window").width;
  const imageWidth = windowWidth - 40;
  const imageHeight = 400;

  const getCurrentUserId = (): string | null => {
    if (user?.id) return user.id.toString();
    if (profile?.user?._id) return profile.user._id.toString();
    if (profile?._id) return profile._id.toString();
    return null;
  };

  const currentUserId = getCurrentUserId();

  const isOwnPost = (): boolean => {
    if (post.isAnonymous && post.originalUser) {
      return currentUserId === post.originalUser._id?.toString();
    }
    return currentUserId === post.user?._id?.toString();
  };

  const ownPost = isOwnPost();

  const getFullImageUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;

    const baseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    const cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${baseUrl}${cleanUrl}`;
  };

  const getProfileImage = (): ImageSourcePropType => {
    if (post.isAnonymous) return DEFAULT_AVATAR;

    if (!avatarError && post.user?.profilePicture?.trim()) {
      return { uri: getFullImageUrl(post.user.profilePicture) };
    }

    return DEFAULT_AVATAR;
  };

  const getPostImages = () => {
    if (!post.images?.length) return [];
    return post.images.map((image) => ({
      ...image,
      url: getFullImageUrl(image.url),
    }));
  };

  const postImages = getPostImages();
  const userImage = getProfileImage();

  useEffect(() => {
    if (postImages.length > 0) {
      setPostImageError(new Array(postImages.length).fill(false));
    }
  }, [postImages.length]);

  const handleImageError = (index: number) => {
    const newErrors = [...postImageError];
    newErrors[index] = true;
    setPostImageError(newErrors);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / imageWidth);
    setCurrentImageIndex(index);
  };

  const goToImage = (index: number) => {
    setCurrentImageIndex(index);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * imageWidth,
        animated: true,
      });
    }
  };

  const getVisibilityIconName = (): IconName => {
    const icons: Record<string, IconName> = {
      campus: "school-outline",
      connections: "people-outline",
      following: "eye-outline",
      private: "lock-closed-outline",
    };
    return icons[post.visibility] || "globe-outline";
  };

  const getVisibilityDisplayName = (): string => {
    const names: Record<string, string> = {
      campus: "Campus",
      connections: "Connections",
      following: "Following",
      private: "Only Me",
    };
    return names[post.visibility] || "Public";
  };

  const getVisibilityBadgeColor = (): string => {
    const colors: Record<string, string> = {
      campus: "#3b82f6",
      connections: "#8b5cf6",
      following: "#10b981",
      private: "#6b7280",
    };
    return colors[post.visibility] || "#9ca3af";
  };

  const handleMorePress = () => setOptionsVisible(true);

  const handleSave = (postId: string) => {
    setIsSaved(!isSaved);
    if (onSave) onSave(postId);
    Alert.alert(
      isSaved ? "Post Unsaved" : "Post Saved",
      isSaved
        ? "Post removed from your saved items"
        : "Post added to your saved items",
    );
  };

  const handleReport = (postId: string) => {
    setIsReported(true);
    if (onReport) onReport(postId);
    Alert.alert(
      "Report Submitted",
      "Thank you for reporting this post. Our team will review it.",
    );
  };

  const handleHide = (postId: string) => {
    setIsHidden(true);
    if (onHide) onHide(postId);
    Alert.alert("Post Hidden", "You won't see this post anymore");
  };

  const handleCopyLink = (postId: string) => {
    if (onCopyLink) onCopyLink(postId);
    Alert.alert("Link Copied", "Post link copied to clipboard");
  };

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

  const getUserDisplayName = () => {
    if (post.isAnonymous) return "Anonymous";
    return post.user?.name || "User";
  };

  const getUserDisplayHandle = () => {
    if (post.isAnonymous) return "anonymous";
    return post.user?.username || "user";
  };

  const renderAvatar = () => {
    if (post.isAnonymous) {
      return (
        <View style={[styles.postAvatar, styles.anonymousAvatar]}>
          <Ionicons name="eye-off-outline" size={20} color="#9ca3af" />
        </View>
      );
    }

    if (!avatarError && post.user?.profilePicture) {
      return (
        <Image
          source={{ uri: getFullImageUrl(post.user.profilePicture) }}
          style={styles.postAvatar}
          onError={() => setAvatarError(true)}
        />
      );
    }

    return <Image source={DEFAULT_AVATAR} style={styles.postAvatar} />;
  };

  const visibilityIconName = getVisibilityIconName();
  const visibilityBadgeColor = getVisibilityBadgeColor();

  return (
    <>
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          {renderAvatar()}

          <View style={styles.postUserInfo}>
            <View style={styles.postUser}>
              <Text style={styles.postUserName}>{getUserDisplayName()}</Text>

              {!post.isAnonymous && post.user?.verified && (
                <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              )}

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

            <Text style={styles.postUserDetails}>
              @{getUserDisplayHandle()} • {formatTimeAgo(post.createdAt)}
            </Text>
          </View>

          <TouchableOpacity onPress={handleMorePress}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <Text style={styles.postContent}>{post.content}</Text>

        {postImages.length > 0 && (
          <View style={styles.imagesContainer}>
            {postImages.length === 1
              ? renderSingleImage()
              : renderMultipleImages()}

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
              {post.commentCount || post.comments?.length || 0}
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
            <Text style={styles.postActionText}>
              {post.reposts?.length || 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.postAction}
            onPress={() => onSharePress(post._id)}
          >
            <Ionicons name="share-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <PostOptionsModal
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        postId={post._id}
        isOwnPost={ownPost}
        isSaved={isSaved}
        isReported={isReported}
        isHidden={isHidden}
        onEdit={onEdit}
        onDelete={onDelete}
        onSave={handleSave}
        onReport={handleReport}
        onHide={handleHide}
        onShare={onSharePress}
        onMuteUser={onMuteUser}
        onBlockUser={onBlockUser}
        userId={post.user?._id}
      />
    </>
  );
};

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
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
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
