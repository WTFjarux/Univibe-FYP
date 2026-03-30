// app/(tabs)/feed/index.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { useFocusEffect, useRouter, useNavigation } from "expo-router";
import { useAuth } from "../../../lib/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";

// Components
import FeedHeader from "../../components/Feed/FeedHeader";
import CreatePostButton from "../../components/Feed/CreatePostButton";
import FilterTabs from "../../components/Feed/FilterTabs";
import PostCard from "../../components/Feed/Post/PostCard";

// Services
import {
  getPosts,
  toggleLike,
  deletePost,
  Post,
} from "../../../lib/postService";

// Styles
import styles from "../../components/Feed/styles";

export default function FeedScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const needsRefresh = useRef(false);

  // State
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User interaction states
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // Filter options
  const filters = [
    { id: "all", label: "All" },
    { id: "following", label: "Following" },
    { id: "campus", label: "Campus" },
    { id: "anonymous", label: "Anonymous" },
    { id: "trending", label: "Trending" },
  ];

  /**
   * Fetch posts from API with current filter and pagination
   */
  const fetchPosts = async (
    filter = activeFilter,
    pageNum = 1,
    shouldRefresh = false,
  ) => {
    try {
      setError(null);
      const response = await getPosts(filter, pageNum);

      // Filter out hidden posts, muted users, and blocked users
      const filteredPosts = response.posts.filter(
        (post) =>
          !hiddenPosts.has(post._id) &&
          !mutedUsers.has(post.user?._id || "") &&
          !blockedUsers.has(post.user?._id || ""),
      );

      if (pageNum === 1 || shouldRefresh) {
        setPosts(filteredPosts);
      } else {
        setPosts((prev) => [...prev, ...filteredPosts]);
      }

      setHasMore(response.pagination?.pages > pageNum);
    } catch (error: any) {
      console.error("Error fetching posts:", error);
      setError(error.message || "Failed to load posts");

      // Handle session expiry
      if (
        error.message.includes("401") ||
        error.message.includes("unauthorized") ||
        error.message.includes("token")
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
      needsRefresh.current = false;
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

  // ✅ Refresh on focus - always refresh when coming back from comments
  useFocusEffect(
    useCallback(() => {
      console.log("📱 FeedScreen focused - refreshing posts");
      if (token) {
        // Always refresh when screen comes into focus
        fetchPosts(activeFilter, 1, true);
      }
    }, [activeFilter, token]),
  );

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = () => {
    if (token) {
      setRefreshing(true);
      setPage(1);
      fetchPosts(activeFilter, 1, true);
    }
  };

  /**
   * Handle filter tab change
   */
  const handleFilterChange = (filterId: string) => {
    if (token) {
      setActiveFilter(filterId);
      setPage(1);
      setLoading(true);
      fetchPosts(filterId, 1, true);
    }
  };

  /**
   * Handle infinite scroll - load more posts
   */
  const loadMore = () => {
    if (token && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(activeFilter, nextPage);
    }
  };

  // ============ POST INTERACTION HANDLERS ============

  /**
   * Handle like/unlike post
   */
  const handleLike = async (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to like posts");
      return;
    }

    try {
      const response = await toggleLike(postId);

      setPosts((prev) =>
        prev.map((post) =>
          post._id === postId
            ? {
                ...post,
                likes: response.isLiked
                  ? [...(post.likes || []), { _id: user?.id || "current-user" }]
                  : post.likes?.filter((like: any) => like._id !== user?.id),
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

  /**
   * Navigate to comments screen
   */
  const handleComment = (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to comment");
      return;
    }

    // Set flag that we'll need to refresh when coming back
    needsRefresh.current = true;

    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  };

  /**
   * Handle repost (coming soon)
   */
  const handleRepost = () => {
    Alert.alert("Repost", "Repost feature coming soon!");
  };

  /**
   * Handle share (coming soon)
   */
  const handleShare = () => {
    Alert.alert("Share", "Share feature coming soon!");
  };

  // ============ POST OPTION HANDLERS ============

  /**
   * Handle edit post - navigate to edit screen
   */
  const handleEditPost = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  };

  /**
   * Handle post deletion
   */
  const handleDeletePost = async (postId: string) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts((prev) => prev.filter((post) => post._id !== postId));
            Alert.alert("Success", "Post deleted successfully");
          } catch (error: any) {
            console.error("Error deleting post:", error);
            Alert.alert("Error", error.message || "Failed to delete post");
          }
        },
      },
    ]);
  };

  /**
   * Handle save/unsave post
   */
  const handleSavePost = () => {
    Alert.alert("Save Post", "Save feature coming soon!");
  };

  /**
   * Handle post report
   */
  const handleReportPost = () => {
    Alert.alert(
      "Report Submitted",
      "Thank you for reporting this post. Our team will review it.",
    );
  };

  /**
   * Handle hide post
   */
  const handleHidePost = (postId: string) => {
    setHiddenPosts((prev) => {
      const newSet = new Set(prev);
      newSet.add(postId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    Alert.alert("Post Hidden", "You won't see this post anymore");
  };

  /**
   * Handle copy link
   */
  const handleCopyLink = () => {
    Alert.alert("Link Copied", "Post link copied to clipboard");
  };

  /**
   * Handle mute user
   */
  const handleMuteUser = (userId: string) => {
    Alert.alert("Mute User", "Are you sure you want to mute this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mute",
        onPress: () => {
          setMutedUsers((prev) => {
            const newSet = new Set(prev);
            newSet.add(userId);
            return newSet;
          });
          setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
          Alert.alert(
            "User Muted",
            "You won't see posts from this user anymore",
          );
        },
      },
    ]);
  };

  /**
   * Handle block user
   */
  const handleBlockUser = (userId: string) => {
    Alert.alert(
      "Block User",
      "Are you sure you want to block this user? They won't be able to interact with you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            setBlockedUsers((prev) => {
              const newSet = new Set(prev);
              newSet.add(userId);
              return newSet;
            });
            setPosts((prev) =>
              prev.filter((post) => post.user?._id !== userId),
            );
            Alert.alert(
              "User Blocked",
              "You won't see posts from this user anymore",
            );
          },
        },
      ],
    );
  };

  // ============ UI ACTION HANDLERS ============

  /**
   * Navigate to create post screen
   */
  const handleCreatePost = () => {
    if (!token) {
      Alert.alert("Login Required", "Please login to create posts");
      return;
    }
    router.push("/components/Feed/create");
  };

  /**
   * Handle notifications press (coming soon)
   */
  const handleNotifications = () => {
    if (!token) {
      Alert.alert("Login Required", "Please login to view notifications");
      return;
    }
    Alert.alert("Notifications", "Notifications screen coming soon!");
  };

  /**
   * Navigate to profile screen
   */
  const handleProfilePress = () => {
    router.push("/(tabs)/profile");
  };

  // ============ RENDER HELPERS ============

  /**
   * Render login prompt when user is not authenticated
   */
  const renderLoginPrompt = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Ionicons name="log-in-outline" size={64} color="#9ca3af" />
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

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    </SafeAreaView>
  );

  /**
   * Render empty state when no posts
   */
  const renderEmptyState = () => (
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
        <Text style={styles.createFirstPostText}>Create First Post</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Render error state with retry option
   */
  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => fetchPosts(activeFilter, 1, true)}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Early returns for auth and loading states
  if (!token) return renderLoginPrompt();
  if (loading && posts.length === 0) return renderLoading();

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
        {/* Header */}
        <FeedHeader
          onNotificationPress={handleNotifications}
          onProfilePress={handleProfilePress}
        />

        {/* Create Post Button */}
        <CreatePostButton onPress={handleCreatePost} />

        {/* Filter Tabs */}
        <FilterTabs
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
        />

        {/* Error Display */}
        {error && renderError()}

        {/* Posts List */}
        <View style={styles.postsContainer}>
          {posts.length === 0 && !loading
            ? renderEmptyState()
            : posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onLikePress={handleLike}
                  onCommentPress={handleComment}
                  onRepostPress={handleRepost}
                  onSharePress={handleShare}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                  onSave={handleSavePost}
                  onReport={handleReportPost}
                  onHide={handleHidePost}
                  onCopyLink={handleCopyLink}
                  onMuteUser={handleMuteUser}
                  onBlockUser={handleBlockUser}
                />
              ))}
        </View>

        {/* Loading Indicator */}
        {loading && posts.length > 0 && (
          <ActivityIndicator style={styles.loader} color="#8b5cf6" />
        )}

        {/* End of Feed Message */}
        {!hasMore && posts.length > 0 && (
          <View style={styles.endMessage}>
            <Text style={styles.endMessageText}>No more posts to load</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
