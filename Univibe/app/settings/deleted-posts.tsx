// app/profile/deleted-posts.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import {
  Post,
  restorePost,
  permanentlyDeletePost,
} from "../../lib/services/postService";
import PostCard from "../components/Feed/Post/PostCard";
import { API_BASE_URL } from "../../constants/ipConstants";

export default function DeletedPostsScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [deletedPosts, setDeletedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadDeletedPosts = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;

      if (shouldAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "10",
        });

        const response = await fetch(
          `${API_BASE_URL}/api/posts/deleted?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
        const data = await response.json();

        if (data.success && data.data) {
          if (shouldAppend) {
            setDeletedPosts((prev) => [...prev, ...data.data.posts]);
          } else {
            setDeletedPosts(data.data.posts);
          }

          setHasMore(data.data.pagination.page < data.data.pagination.pages);
          setPage(pageNum);
        } else {
          setDeletedPosts([]);
        }
      } catch (error) {
        console.error("Error loading deleted posts:", error);
        Alert.alert("Error", "Failed to load deleted posts");
        setDeletedPosts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await loadDeletedPosts(1, false);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadDeletedPosts(page + 1, true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadDeletedPosts(1, false);
      }
    }, [token]),
  );

  const handleRestore = async (postId: string) => {
    Alert.alert(
      "Restore Post",
      "Do you want to restore this post? It will reappear in your profile and feeds.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            setDeletedPosts((prev) =>
              prev.filter((post) => post._id !== postId),
            );

            try {
              await restorePost(postId);
              Alert.alert("Success", "Post restored successfully");
            } catch (error: any) {
              await loadDeletedPosts(1, false);
              Alert.alert("Error", error.message || "Failed to restore post");
            }
          },
        },
      ],
    );
  };

  const handlePermanentDelete = async (postId: string) => {
    Alert.alert(
      "Permanently Delete",
      "This action cannot be undone. The post will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            setDeletedPosts((prev) =>
              prev.filter((post) => post._id !== postId),
            );

            try {
              await permanentlyDeletePost(postId);
              Alert.alert("Success", "Post permanently deleted");
            } catch (error: any) {
              await loadDeletedPosts(1, false);
              Alert.alert(
                "Error",
                error.message || "Failed to permanently delete post",
              );
            }
          },
        },
      ],
    );
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCardContainer}>
      <PostCard
        post={item}
        compact={true}
        hideActions={true}
        onLikePress={() => {}}
        onCommentPress={() => {}}
        onSharePress={() => {}}
        onSave={() => {}}
        onReport={() => {}}
        onHide={() => {}}
        onCopyLink={() => {}}
        onMuteUser={() => {}}
        onBlockUser={() => {}}
      />
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={() => handleRestore(item._id)}
        >
          <Ionicons name="refresh-outline" size={20} color="#10b981" />
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.permanentDeleteButton}
          onPress={() => handlePermanentDelete(item._id)}
        >
          <Ionicons name="trash-outline" size={20} color="#ef4444" />
          <Text style={styles.permanentDeleteText}>Delete Permanently</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="trash-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No deleted posts</Text>
      <Text style={styles.emptyText}>
        Posts you delete will appear here for 30 days
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Deleted Posts</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#8b5cf6" />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading deleted posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderHeader()}
      <FlatList
        data={deletedPosts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-SemiBold",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  postCardContainer: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 12,
  },
  restoreButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    gap: 8,
  },
  restoreText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  permanentDeleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    gap: 8,
  },
  permanentDeleteText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    fontFamily: "SofiaSans-SemiBold",
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
});
