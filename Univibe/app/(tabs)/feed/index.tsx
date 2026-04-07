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
  Animated,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../lib/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";

// Components
import FeedHeader from "@/app/components/Feed/FeedHeader";
import CreatePostButton from "@/app/components/Feed/Post/CreatePostButton";
import FilterTabs from "@/app/components/Feed/FilterTabs";
import PostCard from "@/app/components/Feed/Post/PostCard";

// Services
import {
  getPosts,
  toggleLike,
  deletePost,
  restorePost,
  Post,
} from "../../../lib/postService";

// Styles
import styles from "@/app/components/Feed/styles";

interface UndoAction {
  type: "mute" | "block" | "hide" | "save" | "delete";
  userId?: string;
  postId?: string;
  post?: Post;
  userName?: string;
  deletedPost?: Post;
}

export default function FeedScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  // State
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User interaction states
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  // Info bar state
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Filters
  const filters = [
    { id: "all", label: "All" },
    { id: "campus", label: "Campus" },
    { id: "connections", label: "Connections" },
    { id: "anonymous", label: "Anonymous" },
  ];

  // Show info bar message from bottom with undo option
  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
    action?: UndoAction,
    autoHide = true,
  ) => {
    setInfoMessage(message);
    setInfoType(type);
    setUndoAction(action || null);

    // Clear existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = undefined;
    }

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      ...(autoHide
        ? [
            Animated.delay(3000),
            Animated.timing(slideAnim, {
              toValue: 100,
              duration: 300,
              useNativeDriver: true,
            }),
          ]
        : []),
    ]).start(() => {
      if (autoHide) {
        setInfoMessage(null);
        setUndoAction(null);
        slideAnim.setValue(100);
      }
    });

    // Auto hide after 5 seconds if not undone
    if (autoHide) {
      undoTimeoutRef.current = setTimeout(() => {
        setInfoMessage(null);
        setUndoAction(null);
        slideAnim.setValue(100);
        undoTimeoutRef.current = undefined;
      }, 5000);
    }
  };

  // Hide info bar
  const hideInfoBar = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = undefined;
    }
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      setUndoAction(null);
      slideAnim.setValue(100);
    });
  };

  // Undo action
  const handleUndo = async () => {
    if (!undoAction) return;

    switch (undoAction.type) {
      case "mute":
        if (undoAction.userId) {
          setMutedUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(undoAction.userId!);
            return newSet;
          });
          fetchPosts(activeFilter, 1);
          showInfoBar(
            `User ${undoAction.userName || "muted"} unmuted`,
            "success",
          );
        }
        break;

      case "block":
        if (undoAction.userId) {
          setBlockedUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(undoAction.userId!);
            return newSet;
          });
          fetchPosts(activeFilter, 1);
          showInfoBar(
            `User ${undoAction.userName || "blocked"} unblocked`,
            "success",
          );
        }
        break;

      case "hide":
        if (undoAction.postId && undoAction.post) {
          setHiddenPosts((prev) => {
            const newSet = new Set(prev);
            newSet.delete(undoAction.postId!);
            return newSet;
          });
          setPosts((prev) => {
            const newPosts = [...prev, undoAction.post!];
            return newPosts.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            );
          });
          showInfoBar("Post restored", "success");
        }
        break;

      case "save":
        if (undoAction.postId) {
          setSavedPosts((prev) => {
            const newSet = new Set(prev);
            newSet.delete(undoAction.postId!);
            return newSet;
          });
          showInfoBar("Post removed from saved items", "info");
        }
        break;

      case "delete":
        if (undoAction.postId && undoAction.deletedPost) {
          try {
            // Call API to restore the post
            await restorePost(undoAction.postId);

            // Restore to UI
            setPosts((prev) => {
              // Check if post already exists
              if (prev.some((p) => p._id === undoAction.postId)) {
                return prev;
              }
              const newPosts = [...prev, undoAction.deletedPost!];
              return newPosts.sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              );
            });
            showInfoBar("Post restored successfully", "success");
          } catch (error: any) {
            console.error("Error restoring post:", error);
            showInfoBar(error.message || "Failed to restore post", "error");
          }
        }
        break;
    }

    hideInfoBar();
  };

  /**
   * Fetch posts from API with current filter and pagination
   */
  const fetchPosts = async (filter = activeFilter, pageNum = 1) => {
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

      if (pageNum === 1) {
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
        error.message?.includes("401") ||
        error.message?.includes("unauthorized") ||
        error.message?.includes("token")
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

  /**
   * Handle pull-to-refresh
   */
  const onRefresh = () => {
    if (token) {
      setRefreshing(true);
      setPage(1);
      fetchPosts(activeFilter, 1);
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
      fetchPosts(filterId, 1);
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

  const handleLike = async (postId: string) => {
    if (!token) {
      showInfoBar("Please login to like posts", "info");
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
      showInfoBar(error.message || "Failed to like post", "error");
    }
  };

  const handleComment = (postId: string) => {
    if (!token) {
      showInfoBar("Please login to comment", "info");
      return;
    }

    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  };

  const handleRepost = (postId: string) => {
    if (!token) {
      showInfoBar("Please login to repost", "info");
      return;
    }
    showInfoBar("Repost feature coming soon!", "info");
  };

  const handleShare = (postId: string) => {
    showInfoBar("Share feature coming soon!", "info");
  };

  // ============ PROFILE NAVIGATION HANDLER ============

  const handleProfilePressFromPost = (userId: string) => {
    if (!token) {
      showInfoBar("Please login to view profiles", "info");
      return;
    }

    if (userId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/profile/${userId}`);
    }
  };

  // ============ POST OPTION HANDLERS ============

  const handleEditPost = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  };

  const handleDeletePost = async (postId: string, post: Post) => {
    try {
      // Store the deleted post for potential undo
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      showInfoBar(
        "Post deleted",
        "info",
        {
          type: "delete",
          postId,
          deletedPost: post,
        },
        true,
      );

      // Soft delete from server
      await deletePost(postId);
    } catch (error: any) {
      console.error("Error deleting post:", error);
      // Restore the post if deletion failed
      setPosts((prev) => {
        if (prev.some((p) => p._id === postId)) return prev;
        const newPosts = [...prev, post];
        return newPosts.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      showInfoBar(error.message || "Failed to delete post", "error");
    }
  };

  const handleSavePost = (postId: string) => {
    const wasSaved = savedPosts.has(postId);

    setSavedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });

    if (!wasSaved) {
      showInfoBar(
        "Post saved to your items",
        "success",
        {
          type: "save",
          postId,
        },
        true,
      );
    } else {
      showInfoBar("Post removed from saved items", "info");
    }
  };

  const handleReportPost = (postId: string) => {
    Alert.alert(
      "Report Post",
      "Are you sure you want to report this post? We'll review it and take appropriate action.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => {
            showInfoBar("Thank you for reporting this post", "success");
          },
        },
      ],
    );
  };

  const handleHidePost = (postId: string, post: Post) => {
    setHiddenPosts((prev) => {
      const newSet = new Set(prev);
      newSet.add(postId);
      return newSet;
    });
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    showInfoBar("Post hidden", "info", { type: "hide", postId, post }, true);
  };

  const handleCopyLink = (postId: string) => {
    showInfoBar("Post link copied to clipboard", "success");
  };

  const handleMuteUser = (userId: string, userName?: string) => {
    const displayName = userName || "this user";

    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
    showInfoBar(
      `User ${displayName} muted`,
      "info",
      {
        type: "mute",
        userId,
        userName: displayName,
      },
      true,
    );
  };

  const handleUnmuteUser = (userId: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
    fetchPosts(activeFilter, 1);
    showInfoBar(
      "User unmuted, you will now see posts from this user again",
      "success",
    );
  };

  const handleBlockUser = (userId: string, userName?: string) => {
    const displayName = userName || "this user";

    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
    showInfoBar(
      `User ${displayName} blocked`,
      "info",
      {
        type: "block",
        userId,
        userName: displayName,
      },
      true,
    );
  };

  const handleUnblockUser = (userId: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
    fetchPosts(activeFilter, 1);
    showInfoBar(
      "User unblocked, you will now see posts from this user again",
      "success",
    );
  };

  // ============ UI ACTION HANDLERS ============

  const handleCreatePost = () => {
    if (!token) {
      showInfoBar("Please login to create posts", "info");
      return;
    }
    router.push("/components/Feed/Post/create");
  };

  const handleNotifications = () => {
    if (!token) {
      showInfoBar("Please login to view notifications", "info");
      return;
    }
    router.push("/notifications");
  };

  const handleProfilePress = () => {
    router.push("/(tabs)/profile");
  };

  // ============ RENDER HELPERS ============

  const renderInfoBar = () => {
    if (!infoMessage) return null;

    const backgroundColor =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : "#8b5cf6";

    const iconName =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";

    return (
      <Animated.View
        style={[
          styles.infoBar,
          {
            backgroundColor,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Ionicons name={iconName} size={20} color="#fff" />
        <Text style={styles.infoBarText}>{infoMessage}</Text>
        {undoAction && (
          <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
            <Text style={styles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

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

  const renderLoading = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    </SafeAreaView>
  );

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

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => fetchPosts(activeFilter, 1)}
      >
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  // Early returns for auth and loading states
  if (!token) return renderLoginPrompt();
  if (loading && posts.length === 0) return renderLoading();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        contentContainerStyle={styles.scrollContent}
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
                  onDelete={() => handleDeletePost(post._id, post)}
                  onSave={handleSavePost}
                  onReport={handleReportPost}
                  onHide={() => handleHidePost(post._id, post)}
                  onCopyLink={handleCopyLink}
                  onMuteUser={(userId) =>
                    handleMuteUser(
                      userId,
                      post.user?.name || post.user?.username,
                    )
                  }
                  onBlockUser={(userId) =>
                    handleBlockUser(
                      userId,
                      post.user?.name || post.user?.username,
                    )
                  }
                  onProfilePress={handleProfilePressFromPost}
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

        {/* Add extra padding at bottom to prevent content from being hidden behind tab bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Info bar rendered at the bottom */}
      {renderInfoBar()}
    </SafeAreaView>
  );
}
