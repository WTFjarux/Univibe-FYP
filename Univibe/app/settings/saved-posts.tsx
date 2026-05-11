// app/profile/saved-posts.tsx

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import { Post } from "../../lib/services/postService";
import {
  getSavedPosts,
  toggleSavePost,
} from "../../lib/services/contentService";
import PostCard from "../components/Feed/Post/PostCard";

export default function SavedPostsScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useRef(new Animated.Value(100)).current;
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setInfoMessage(message);
    setInfoType(type);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
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
    infoTimeoutRef.current = setTimeout(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    }, 4000);
  };

  const loadSavedPosts = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;
      if (shouldAppend) setLoadingMore(true);
      else setLoading(true);
      try {
        const response = await getSavedPosts(pageNum, 10);
        if (response.success && response.data) {
          const newPosts = response.data.posts;
          if (shouldAppend) setSavedPosts((prev) => [...prev, ...newPosts]);
          else setSavedPosts(newPosts);
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages,
          );
          setPage(pageNum);
        }
      } catch (error) {
        showInfoBar("Failed to load saved posts", "error");
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
    await loadSavedPosts(1, false);
  };
  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) loadSavedPosts(page + 1, true);
  };

  useFocusEffect(
    useCallback(() => {
      if (token) loadSavedPosts(1, false);
    }, [token]),
  );

  const handleComment = (postId: string) =>
    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });

  const handleSavePost = async (postId: string) => {
    const postToRemove = savedPosts.find((p) => p._id === postId);
    if (!postToRemove) return;
    setSavedPosts((prev) => prev.filter((post) => post._id !== postId));
    showInfoBar("Post removed from saved", "info");
    try {
      await toggleSavePost(postId);
    } catch (error: any) {
      if (postToRemove) setSavedPosts((prev) => [postToRemove, ...prev]);
      showInfoBar(error.message || "Failed to unsave post", "error");
    }
  };

  const handleProfilePress = (userId: string) => {
    if (!userId) return;
    router.push(userId === user?.id ? "/(tabs)/profile" : `/profile/${userId}`);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCardContainer}>
      <PostCard
        post={{ ...item, isSaved: true }}
        onLikePress={() => {}}
        onCommentPress={handleComment}
        onSharePress={() => {}}
        onSave={handleSavePost}
        onReport={() => {}}
        onHide={() => {}}
        onCopyLink={() => {}}
        onMuteUser={() => {}}
        onBlockUser={() => {}}
        onProfilePress={handleProfilePress}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>Loading saved posts...</Text>
        </View>
      ) : (
        <FlatList
          data={savedPosts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No saved posts</Text>
              <Text style={styles.emptyText}>
                Posts you save will appear here
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => router.push("/(tabs)/feed")}
              >
                <Text style={styles.browseButtonText}>Browse Feed</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#8b5cf6" />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            ) : null
          }
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
      )}
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
                    : "#8b5cf6",
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Ionicons
            name={
              infoType === "success"
                ? "checkmark-circle"
                : infoType === "error"
                  ? "alert-circle"
                  : "information-circle"
            }
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
  container: { flex: 1, backgroundColor: "#f9fafb" },
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
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-SemiBold",
  },
  listContent: { flexGrow: 1, paddingBottom: 20 },
  postCardContainer: { padding: 16, marginBottom: 8 },
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
  browseButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#8b5cf6",
    borderRadius: 20,
  },
  browseButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  infoBar: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  },
});
