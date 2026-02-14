// app/(tabs)/feed/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity, 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../lib/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons"; 

// Components
import FeedHeader from "../../components/Feed/FeedHeader";
import CreatePostButton from "../../components/Feed/CreatePostButton";
import FilterTabs from "../../components/Feed/FilterTabs";
import PostCard from "../../components/Feed/PostCard";

// Services
import { getPosts, toggleLike, Post } from "../../../lib/postService";

// Styles
import styles from "../../components/Feed/styles";

export default function FeedScreen() {
  const router = useRouter();
  const { token } = useAuth(); // Get token from auth context
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = [
    { id: "all", label: "All" },
    { id: "following", label: "Following" },
    { id: "campus", label: "Campus" },
    { id: "trending", label: "Trending" },
  ];

  // Fetch posts function
  const fetchPosts = async (filter = activeFilter, pageNum = 1) => {
    try {
      setError(null);
      const response = await getPosts(filter, pageNum);

      if (pageNum === 1) {
        setPosts(response.posts);
      } else {
        setPosts((prev) => [...prev, ...response.posts]);
      }

      setHasMore(response.pagination.pages > pageNum);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      setError(error.message || "Failed to load posts");

      // If unauthorized, show login prompt
      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized")
      ) {
        Alert.alert("Session Expired", "Please login again to continue", [
          {
            text: "Login",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (token) {
      fetchPosts();
    } else {
      setLoading(false);
      setError("Please login to view posts");
    }
  }, [token]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchPosts(activeFilter, 1);
      }
    }, [activeFilter, token]),
  );

  // Handle refresh
  const onRefresh = () => {
    if (token) {
      setRefreshing(true);
      setPage(1);
      fetchPosts(activeFilter, 1);
    }
  };

  // Handle filter change
  const handleFilterChange = (filterId: string) => {
    if (token) {
      setActiveFilter(filterId);
      setPage(1);
      setLoading(true);
      fetchPosts(filterId, 1);
    }
  };

  // Handle like
  const handleLike = async (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to like posts");
      return;
    }

    try {
      const response = await toggleLike(postId);

      // Update local state
      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? {
                ...post,
                likes: response.isLiked
                  ? [...(post.likes || []), { _id: "current-user" }]
                  : post.likes?.filter(
                      (like: any) => like._id !== "current-user",
                    ),
                isLiked: response.isLiked,
              }
            : post,
        ),
      );
    } catch (error: any) {
      console.error("Error liking post:", error);
      Alert.alert("Error", error.message || "Failed to like post");
    }
  };

  // Handle comment
  const handleComment = (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to comment");
      return;
    }
    Alert.alert("Comments", "Comments feature coming soon!");
  };

  // Handle repost
  const handleRepost = (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to repost");
      return;
    }
    Alert.alert("Repost", "Repost feature coming soon!");
  };

  // Handle share
  const handleShare = (postId: string) => {
    Alert.alert("Share", "Share feature coming soon!");
  };

  // Handle more options
  const handleMoreOptions = (postId: string) => {
    Alert.alert("Options", "More options coming soon!");
  };

  // Handle create post press
  const handleCreatePost = () => {
    if (!token) {
      Alert.alert("Login Required", "Please login to create posts");
      return;
    }
    router.push("/components/Feed/create");
  };

  // Handle notification press
  const handleNotifications = () => {
    if (!token) {
      Alert.alert("Login Required", "Please login to view notifications");
      return;
    }
    Alert.alert("Notifications", "Notifications screen coming soon!");
  };

  // Load more posts
  const loadMore = () => {
    if (token && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(activeFilter, nextPage);
    }
  };

  // Show login prompt if no token
  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Please login to view the feed</Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 50;

          if (isCloseToBottom && hasMore && !loading) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        <FeedHeader onNotificationPress={handleNotifications} />

        <CreatePostButton onPress={handleCreatePost} />

        <FilterTabs
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchPosts(activeFilter, 1)}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.postsContainer}>
          {posts.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No posts yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Be the first to share something on campus!
              </Text>
              <TouchableOpacity
                style={styles.createFirstPostButton}
                onPress={handleCreatePost}
              >
                <Text style={styles.createFirstPostText}>
                  Create First Post
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                onLikePress={handleLike}
                onCommentPress={handleComment}
                onRepostPress={handleRepost}
                onSharePress={handleShare}
                onMorePress={handleMoreOptions}
              />
            ))
          )}
        </View>

        {loading && posts.length > 0 && (
          <ActivityIndicator style={styles.loader} color="#8b5cf6" />
        )}

        {!hasMore && posts.length > 0 && (
          <View style={styles.endMessage}>
            <Text style={styles.endMessageText}>No more posts to load</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
