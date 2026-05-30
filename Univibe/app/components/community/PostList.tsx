// app/components/Community/PostList.tsx

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import PostCard from "../Feed/Post/PostCard";
import { Post } from "../../../lib/services/postService";

interface PostListProps {
  posts: Post[];
  loading: boolean;
  isAdmin: boolean;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onDelete: (postId: string) => void;
  onCreatePost: () => void;
}

export default function PostList({
  posts,
  loading,
  isAdmin,
  onLike,
  onComment,
  onDelete,
  onCreatePost,
}: PostListProps) {
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons
          name="newspaper-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No posts yet
        </Text>
        {isAdmin && (
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={onCreatePost}
          >
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.createBtnText}>Create First Post</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View>
      {posts.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          onLikePress={onLike}
          onCommentPress={onComment}
          onSharePress={() => {}}
          onDelete={isAdmin ? onDelete : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 40, alignItems: "center" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyText: { fontSize: 16, fontFamily: "SofiaSans-Regular", marginTop: 12 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  createBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
});
