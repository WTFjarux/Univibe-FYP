// app/profile/hidden-posts.tsx

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
import { useTheme } from "../../lib/contexts/ThemeContext";
import { Post } from "../../lib/services/postService";
import { getHiddenPosts, unhidePost } from "../../lib/services/contentService";
import PostCard from "../components/Feed/Post/PostCard";

export default function HiddenPostsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { colors } = useTheme();
  const [hiddenPosts, setHiddenPosts] = useState<Post[]>([]);
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

  const loadHiddenPosts = useCallback(
    async (pageNum: number = 1, shouldAppend: boolean = false) => {
      if (!token) return;
      if (shouldAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const response = await getHiddenPosts(pageNum, 10);
        if (response.success && response.data) {
          const newPosts = response.data.posts;
          if (shouldAppend) {
            setHiddenPosts((prev) => [...prev, ...newPosts]);
          } else {
            setHiddenPosts(newPosts);
          }
          setHasMore(
            response.data.pagination.page < response.data.pagination.pages,
          );
          setPage(pageNum);
        } else {
          setHiddenPosts([]);
        }
      } catch (error) {
        showInfoBar("Failed to load hidden posts", "error");
        setHiddenPosts([]);
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
    await loadHiddenPosts(1, false);
  };
  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      loadHiddenPosts(page + 1, true);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadHiddenPosts(1, false);
      }
    }, [token]),
  );

  const handleUnhide = async (postId: string) => {
    setHiddenPosts((prev) => prev.filter((post) => post._id !== postId));
    showInfoBar("Post restored to feed", "success");
    try {
      await unhidePost(postId);
    } catch (error: any) {
      await loadHiddenPosts(1, false);
      showInfoBar(error.message || "Failed to unhide post", "error");
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard
      post={item}
      compact={false}
      hideActions={false}
      isHidden={true}
      onUnhide={handleUnhide}
      onLikePress={() => {}}
      onCommentPress={() => {}}
      onSharePress={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      onSave={() => {}}
      onReport={() => {}}
      onHide={() => {}}
      onCopyLink={() => {}}
      onMuteUser={() => {}}
      onBlockUser={() => {}}
      onProfilePress={(userId: string) => {
        router.push(`/profile/${userId}`);
      }}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="eye-off-outline" size={64} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No hidden posts
      </Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Posts you hide will appear here
      </Text>
      <TouchableOpacity
        style={[styles.browseButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push("/(tabs)/feed")}
      >
        <Text style={styles.browseButtonText}>Browse Feed</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Hidden Posts
        </Text>
        <View style={{ width: 40 }} />
      </View>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading hidden posts...
          </Text>
        </View>
      ) : (
        <FlatList
          data={hiddenPosts}
          keyExtractor={(item) => item._id}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text
                  style={[
                    styles.loadingMoreText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Loading more...
                </Text>
              </View>
            ) : null
          }
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
                    : colors.primary,
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
  browseButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  browseButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
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
