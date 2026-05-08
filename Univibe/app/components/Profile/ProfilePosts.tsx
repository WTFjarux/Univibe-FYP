// app/components/Profile/ProfilePosts.tsx

import React from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import PostCard from "../Feed/Post/PostCard";
import { Post } from "../../../lib/services/postService";

interface ProfilePostsProps {
  posts: Post[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  onLikePress: (postId: string) => void;
  onCommentPress: (postId: string) => void;
  onSharePress: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onCopyLink?: (postId: string) => void;
  onMuteUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  listHeaderComponent?: React.ReactElement;
  listFooterComponent?: React.ReactElement | null;
}

export default function ProfilePosts({
  posts,
  loading,
  refreshing,
  onRefresh,
  onLoadMore,
  hasMore,
  onLikePress,
  onCommentPress,
  onSharePress,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onHide,
  onCopyLink,
  onMuteUser,
  onBlockUser,
  listHeaderComponent,
  listFooterComponent,
}: ProfilePostsProps) {
  const router = useRouter();

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>
        Share your first post to connect with the campus community!
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push("/components/Feed/Post/create")}
      >
        <Text style={styles.createButtonText}>Create Post</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#8b5cf6" />
      </View>
    );
  };

  // Show skeleton loading state when loading and no posts
  if (loading && posts.length === 0) {
    return (
      <FlatList
        data={[]}
        keyExtractor={() => "empty"}
        renderItem={() => null}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={null}
        ListFooterComponent={listFooterComponent || renderFooter()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.contentContainer}
      />
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => (
        <View style={styles.postCardWrapper}>
          <PostCard
            post={item}
            onLikePress={onLikePress}
            onCommentPress={onCommentPress}
            onSharePress={onSharePress}
            onEdit={onEdit}
            onDelete={onDelete}
            onSave={onSave}
            onReport={onReport}
            onHide={onHide}
            onCopyLink={onCopyLink}
            onMuteUser={onMuteUser}
            onBlockUser={onBlockUser}
          />
        </View>
      )}
      ListHeaderComponent={listHeaderComponent}
      ListEmptyComponent={!loading ? renderEmptyState() : null}
      ListFooterComponent={
        listFooterComponent !== undefined ? listFooterComponent : renderFooter()
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#8b5cf6"
          colors={["#8b5cf6"]}
        />
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.contentContainer}
    />
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
  postCardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
});
