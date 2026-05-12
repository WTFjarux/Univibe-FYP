import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { PostSearchResult as PostSearchResultType } from "../../../lib/types/search";
import { getFullImageUrl } from "../../../lib/services/postService";
import { formatTimeAgo } from "../../../lib/utils/formatTime";

interface PostSearchResultProps {
  post: PostSearchResultType;
}

const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

/**
 * Compact post search result card.
 *
 * Features:
 * - Author avatar with fallback
 * - Content preview (truncated to 2 lines)
 * - Post image thumbnail (if available)
 * - Like and comment counts
 * - Timestamp
 * - Navigates to post detail on tap
 */
export const PostSearchResult: React.FC<PostSearchResultProps> = ({ post }) => {
  const router = useRouter();
  const [avatarError, setAvatarError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handlePress = () => {
    router.push({
      pathname: "/post/[id]",
      params: { id: post._id },
    });
  };

  const handleAuthorPress = (e: any) => {
    e.stopPropagation();
    if (post.user._id) {
      router.push(`/profile/${post.user._id}`);
    }
  };

  const getAvatarSource = () => {
    if (post.user?.profilePicture && !avatarError) {
      return { uri: getFullImageUrl(post.user.profilePicture) };
    }
    return DEFAULT_AVATAR;
  };

  const getPostThumbnail = () => {
    if (post.images?.length > 0 && !imageError) {
      return { uri: getFullImageUrl(post.images[0].url) };
    }
    return null;
  };

  const thumbnailSource = getPostThumbnail();
  const displayName = post.isAnonymous
    ? "Anonymous"
    : post.user?.name || "User";
  const displayHandle = post.isAnonymous
    ? "anonymous"
    : post.user?.username || "user";

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Author Row */}
      <View style={styles.authorRow}>
        <TouchableOpacity
          onPress={handleAuthorPress}
          disabled={post.isAnonymous}
          style={styles.avatarContainer}
        >
          {post.isAnonymous ? (
            <View style={[styles.avatar, styles.anonymousAvatar]}>
              <Ionicons name="eye-off-outline" size={16} color="#9ca3af" />
            </View>
          ) : (
            <Image
              source={getAvatarSource()}
              style={styles.avatar}
              onError={() => setAvatarError(true)}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAuthorPress}
          disabled={post.isAnonymous}
          style={styles.authorInfo}
        >
          <View style={styles.nameRow}>
            <Text style={styles.authorName} numberOfLines={1}>
              {displayName}
            </Text>
            {post.user?.verified && (
              <Ionicons name="checkmark-circle" size={14} color="#8b5cf6" />
            )}
          </View>
          <Text style={styles.authorMeta} numberOfLines={1}>
            @{displayHandle} • {formatTimeAgo(post.createdAt)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.moreButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* Content Preview */}
      {post.content ? (
        <Text style={styles.content} numberOfLines={2}>
          {post.content}
        </Text>
      ) : null}

      {/* Image Thumbnail + Content Layout */}
      {thumbnailSource && (
        <View style={styles.thumbnailContainer}>
          <Image
            source={thumbnailSource}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          {post.images.length > 1 && (
            <View style={styles.imageCountBadge}>
              <Ionicons name="images-outline" size={12} color="#ffffff" />
              <Text style={styles.imageCountText}>{post.images.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* Engagement Row */}
      <View style={styles.engagementRow}>
        <View style={styles.engagementItem}>
          <Ionicons
            name={post.isLiked ? "heart" : "heart-outline"}
            size={14}
            color={post.isLiked ? "#ef4444" : "#9ca3af"}
          />
          <Text style={styles.engagementText}>
            {post.likeCount ?? post.likes?.length ?? 0}
          </Text>
        </View>

        <View style={styles.engagementItem}>
          <Ionicons name="chatbubble-outline" size={14} color="#9ca3af" />
          <Text style={styles.engagementText}>{post.commentCount}</Text>
        </View>

        {post.tags?.length > 0 && (
          <View style={styles.tagsContainer}>
            {post.tags.slice(0, 2).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  #{tag}
                </Text>
              </View>
            ))}
            {post.tags.length > 2 && (
              <Text style={styles.moreTagsText}>+{post.tags.length - 2}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    margin: 18,
    borderRadius: 12,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarContainer: {
    marginRight: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
  },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  authorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  authorName: {
    fontSize: 14,
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  authorMeta: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    marginTop: 1,
  },
  moreButton: {
    padding: 4,
  },
  content: {
    fontSize: 14,
    color: "#374151",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 20,
    marginBottom: 8,
  },
  thumbnailContainer: {
    position: "relative",
    marginBottom: 18,
    borderRadius: 18,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: 160,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingLeft: 18,
    paddingRight:18,
  },
  imageCountBadge: {
    position: "absolute",
    top: 8,
    right: 22,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  imageCountText: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: "SofiaSans-Medium",
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  engagementText: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  tagsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  tag: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Medium",
  },
  moreTagsText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
});

export default PostSearchResult;
