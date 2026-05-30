// app/components/Search/PostSearchResult.tsx

import React, { useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { PostSearchResult as PostSearchResultType } from "../../../lib/types/search";
import { getFullImageUrl } from "../../../lib/services/postService";
import { formatTimeAgo } from "../../../lib/utils/formatTime";

interface PostSearchResultProps {
  post: PostSearchResultType;
}

const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

export const PostSearchResult: React.FC<PostSearchResultProps> = ({ post }) => {
  const router = useRouter();
  const { colors } = useTheme();
  const [avatarError, setAvatarError] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isCommunityPost = !!post.community?.name;

  const displayName = isCommunityPost
    ? post.community!.name
    : post.isAnonymous
      ? "Anonymous"
      : post.user?.name || "User";

  const displayHandle = post.isAnonymous
    ? "anonymous"
    : post.user?.username || "user";

  const handlePress = () => {
    router.push({ pathname: "/post/[id]", params: { id: post._id } });
  };

  const handleCommunityPress = (e: any) => {
    e.stopPropagation();
    if (post.community?._id) {
      router.push(
        `/screens/CommunityScreen?communityId=${post.community._id}` as any,
      );
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

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.authorRow}>
        {/* Avatar */}
        <TouchableOpacity
          onPress={isCommunityPost ? handleCommunityPress : undefined}
          disabled={!isCommunityPost}
          style={styles.avatarContainer}
        >
          {isCommunityPost ? (
            post.community?.coverImage ? (
              <Image
                source={{ uri: getFullImageUrl(post.community.coverImage) }}
                style={[styles.avatar, { backgroundColor: colors.skeleton }]}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.communityAvatar,
                  { backgroundColor: colors.primary + "30" },
                ]}
              >
                <Ionicons name="people" size={18} color={colors.primary} />
              </View>
            )
          ) : post.isAnonymous ? (
            <View
              style={[
                styles.avatar,
                styles.anonymousAvatar,
                {
                  backgroundColor: colors.skeleton,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons
                name="eye-off-outline"
                size={16}
                color={colors.textMuted}
              />
            </View>
          ) : (
            <Image
              source={getAvatarSource()}
              style={[styles.avatar, { backgroundColor: colors.skeleton }]}
              onError={() => setAvatarError(true)}
            />
          )}
        </TouchableOpacity>

        {/* Author Info */}
        <View style={styles.authorInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.authorName, { color: colors.text }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isCommunityPost && (
              <View
                style={[
                  styles.communityBadge,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <Text
                  style={[styles.communityBadgeText, { color: colors.primary }]}
                >
                  Community
                </Text>
              </View>
            )}
            {!isCommunityPost && post.user?.verified && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={colors.primary}
              />
            )}
          </View>
          <Text
            style={[styles.authorMeta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {isCommunityPost
              ? formatTimeAgo(post.createdAt)
              : `@${displayHandle} • ${formatTimeAgo(post.createdAt)}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {post.content ? (
        <Text
          style={[styles.content, { color: colors.text }]}
          numberOfLines={2}
        >
          {post.content}
        </Text>
      ) : null}

      {thumbnailSource && (
        <View style={styles.thumbnailContainer}>
          <Image
            source={thumbnailSource}
            style={[styles.thumbnail, { backgroundColor: colors.skeleton }]}
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

      <View style={styles.engagementRow}>
        <View style={styles.engagementItem}>
          <Ionicons
            name={post.isLiked ? "heart" : "heart-outline"}
            size={14}
            color={post.isLiked ? "#ef4444" : colors.textMuted}
          />
          <Text style={[styles.engagementText, { color: colors.textMuted }]}>
            {post.likeCount ?? post.likes?.length ?? 0}
          </Text>
        </View>
        <View style={styles.engagementItem}>
          <Ionicons
            name="chatbubble-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text style={[styles.engagementText, { color: colors.textMuted }]}>
            {post.commentCount}
          </Text>
        </View>
        {post.tags?.length > 0 && (
          <View style={styles.tagsContainer}>
            {post.tags.slice(0, 2).map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: colors.skeleton }]}
              >
                <Text
                  style={[styles.tagText, { color: colors.primary }]}
                  numberOfLines={1}
                >
                  #{tag}
                </Text>
              </View>
            ))}
            {post.tags.length > 2 && (
              <Text style={[styles.moreTagsText, { color: colors.textMuted }]}>
                +{post.tags.length - 2}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    margin: 18,
    borderRadius: 12,
  },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  avatarContainer: { marginRight: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  communityAvatar: { alignItems: "center", justifyContent: "center" },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  authorInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorName: { fontSize: 14, fontFamily: "SofiaSans-Bold" },
  communityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  communityBadgeText: {
    fontSize: 10,
    fontFamily: "SofiaSans-SemiBold",
  },
  authorMeta: { fontSize: 12, fontFamily: "SofiaSans-Regular", marginTop: 1 },
  moreButton: { padding: 4 },
  content: {
    fontSize: 14,
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
    borderRadius: 8,
    paddingLeft: 18,
    paddingRight: 18,
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
  engagementRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  engagementItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  engagementText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  tagsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontFamily: "SofiaSans-Medium" },
  moreTagsText: { fontSize: 10, fontFamily: "SofiaSans-Regular" },
});

export default PostSearchResult;
