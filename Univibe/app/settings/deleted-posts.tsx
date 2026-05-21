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
  Animated,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useTheme } from "../../lib/contexts/ThemeContext";
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
  const { colors, isDark } = useTheme();
  const [deletedPosts, setDeletedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useState(new Animated.Value(100))[0];

  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setInfoMessage(message);
    setInfoType(type);
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(slideAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    });
  };

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
        showInfoBar("Failed to load deleted posts", "error");
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
              const result = await restorePost(postId);
              if (result.success) {
                showInfoBar("Post restored successfully", "success");
              }
            } catch (error: any) {
              await loadDeletedPosts(1, false);
              showInfoBar(error.message || "Failed to restore post", "error");
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
              const result = await permanentlyDeletePost(postId);
              if (result.success) {
                showInfoBar("Post permanently deleted", "success");
              }
            } catch (error: any) {
              await loadDeletedPosts(1, false);
              showInfoBar(
                error.message || "Failed to permanently delete post",
                "error",
              );
            }
          },
        },
      ],
    );
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={[styles.postCardContainer, { backgroundColor: colors.card }]}>
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
      <View style={[styles.actionButtons, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.restoreButton,
            { backgroundColor: isDark ? "#052e16" : "#f0fdf4" },
          ]}
          onPress={() => handleRestore(item._id)}
        >
          <Ionicons name="refresh-outline" size={20} color="#10b981" />
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.permanentDeleteButton,
            { backgroundColor: isDark ? "#451a1a" : "#fef2f2" },
          ]}
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
      <Ionicons name="trash-outline" size={64} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No deleted posts
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Posts you delete will appear here for 30 days
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Deleted Posts
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
          Loading more...
        </Text>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading deleted posts...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
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
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
          />
        }
      />
      {infoMessage && (
        <Animated.View
          style={[
            styles.infoBar,
            {
              backgroundColor:
                infoType === "success"
                  ? "#10b981"
                  : infoType === "error"
                    ? "#ef4444"
                    : colors.primary,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Ionicons
            name={infoType === "success" ? "checkmark-circle" : "alert-circle"}
            size={20}
            color="#fff"
          />
          <Text style={styles.infoBarText}>{infoMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  postCardContainer: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    marginVertical: 8,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  restoreButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
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
    marginTop: 16,
    fontFamily: "SofiaSans-SemiBold",
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, fontFamily: "SofiaSans-Regular" },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  infoBar: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
    fontFamily: "SofiaSans-Medium",
  },
});
