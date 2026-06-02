// app/(tabs)/feed/index.tsx

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  useMemo,
} from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../lib/contexts/AuthContext";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedHeader from "@/app/components/Feed/FeedHeader";
import CreatePostButton from "@/app/components/Feed/Post/CreatePostButton";
import FilterTabs from "@/app/components/Feed/FilterTabs";
import PostCard from "@/app/components/Feed/Post/PostCard";
import SharePostModal from "@/app/components/Feed/Post/SharePostModal";
import ReportModal from "@/app/components/ReportModal";
import FeedSkeleton, {
  LoadMorePostsSkeleton,
} from "@/app/components/Feed/FeedSkeleton";

import {
  toggleLike,
  deletePost,
  restorePost,
  Post,
  getFullImageUrl,
  toggleBlockUser,
} from "../../../lib/services/postService";

import {
  toggleSavePost,
  hidePost,
  unhidePost,
  toggleMuteUser,
  reportContent,
} from "../../../lib/services/contentService";

import { useFeed, FeedType } from "../../../hooks/useFeed";

import styles from "@/app/components/Feed/styles";

// ============================================================================
// TYPES
// ============================================================================

interface UndoAction {
  type: "mute" | "block" | "hide" | "save" | "delete";
  userId?: string;
  postId?: string;
  post?: Post;
  userName?: string;
  deletedPost?: Post;
}

interface SharePostData {
  postId: string;
  postContent: string;
  postImage: string;
  postAuthorName: string;
  postAuthorAvatar: string;
  isAnonymous: boolean;
  postCommunityId?: string;
  postCommunityName?: string;
  postCommunityCoverImage?: string;
}

// ============================================================================
// MEMOIZED COMPONENTS
// ============================================================================

const MemoizedFeedHeader = memo(FeedHeader);
const MemoizedCreatePostButton = memo(CreatePostButton);
const MemoizedFilterTabs = memo(FilterTabs);
const MemoizedPostCard = memo(PostCard);
const MemoizedSharePostModal = memo(SharePostModal);
const MemoizedReportModal = memo(ReportModal);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * FeedScreen Component
 *
 * Displays the main social feed with support for multiple feed types,
 * infinite scrolling, post interactions, and real-time updates.
 *
 * Features:
 * - Multiple feed types (Campus, Connections, Anonymous, Communities)
 * - Infinite scroll pagination
 * - Pull-to-refresh with cooldown
 * - Optimistic updates for all interactions
 * - Undo functionality for destructive actions
 * - Dark mode support
 * - Offline/error handling
 */
export default function FeedScreen() {
  // ==========================================================================
  // HOOKS
  // ==========================================================================
  const router = useRouter();
  const { token, user } = useAuth();
  const { colors, isDark } = useTheme();
  const feed = useFeed();

  // ==========================================================================
  // MODAL STATES
  // ==========================================================================
  const [shareModalVisible, setShareModalVisible] = useState<boolean>(false);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [reportTargetId, setReportTargetId] = useState<string>("");
  const [reportTargetType, setReportTargetType] = useState<
    "Post" | "Comment" | "User" | "Event"
  >("Post");
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState<boolean>(false);

  // ==========================================================================
  // INFO BAR STATE
  // ==========================================================================
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;

  // ==========================================================================
  // DERIVED VALUES
  // ==========================================================================
  const visiblePosts = feed.currentFeed.posts;

  const filters = useMemo<Array<{ id: FeedType; label: string }>>(
    () => [
      { id: "campus", label: "Campus" },
      { id: "connections", label: "Connections" },
      { id: "anonymous", label: "Anonymous" },
      { id: "communities", label: "Communities" },
    ],
    [],
  );

  const sharePostData = useMemo<SharePostData | null>(() => {
    if (!sharePost) return null;

    return {
      postId: sharePost._id,
      postContent: sharePost.content || "",
      postImage: sharePost.images?.[0]?.url
        ? getFullImageUrl(sharePost.images[0].url)
        : "",
      postAuthorName: sharePost.isAnonymous
        ? "Anonymous"
        : sharePost.community?.name || sharePost.user?.name || "Unknown",
      postAuthorAvatar: sharePost.community?.coverImage
        ? getFullImageUrl(sharePost.community.coverImage)
        : sharePost.user?.profilePicture || "",
      isAnonymous: sharePost.isAnonymous || false,
      postCommunityId: sharePost.community?._id,
      postCommunityName: sharePost.community?.name,
      postCommunityCoverImage: sharePost.community?.coverImage
        ? getFullImageUrl(sharePost.community.coverImage)
        : undefined,
    };
  }, [sharePost]);

  // ==========================================================================
  // INFO BAR METHODS
  // ==========================================================================

  /**
   * Displays a temporary notification bar with optional undo action
   */
  const showInfoBar = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      action?: UndoAction,
      autoHide = true,
    ) => {
      setInfoMessage(message);
      setInfoType(type);
      setUndoAction(action || null);

      const animations: Animated.CompositeAnimation[] = [
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ];

      if (autoHide) {
        animations.push(
          Animated.delay(3000),
          Animated.timing(slideAnim, {
            toValue: 100,
            duration: 300,
            useNativeDriver: true,
          }),
        );
      }

      Animated.sequence(animations).start(() => {
        if (autoHide) {
          setInfoMessage(null);
          setUndoAction(null);
          slideAnim.setValue(100);
        }
      });
    },
    [slideAnim],
  );

  /**
   * Hides the info bar immediately
   */
  const hideInfoBar = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      setUndoAction(null);
      slideAnim.setValue(100);
    });
  }, [slideAnim]);

  /**
   * Handles undo action for destructive operations
   */
  const handleUndo = useCallback(async () => {
    if (!undoAction) return;
    hideInfoBar();

    switch (undoAction.type) {
      case "mute":
        if (undoAction.userId) {
          await toggleMuteUser(undoAction.userId);
          await feed.invalidateAllFeeds();
          showInfoBar(
            `User ${undoAction.userName || "unmuted"} unmuted`,
            "success",
          );
        }
        break;
      case "block":
        if (undoAction.userId) {
          await toggleBlockUser(undoAction.userId);
          await feed.invalidateAllFeeds();
          showInfoBar(
            `User ${undoAction.userName || "unblocked"} unblocked`,
            "success",
          );
        }
        break;
      case "hide":
        if (undoAction.postId) {
          await unhidePost(undoAction.postId);
          await feed.invalidateAllFeeds();
          showInfoBar("Post restored to feed", "success");
        }
        break;
      case "save":
        if (undoAction.postId) {
          await toggleSavePost(undoAction.postId);
          feed.updatePost(undoAction.postId, { isSaved: false });
          showInfoBar("Post removed from saved items", "info");
        }
        break;
      case "delete":
        if (undoAction.postId && undoAction.deletedPost) {
          try {
            await restorePost(undoAction.postId);
            feed.addNewPost(undoAction.deletedPost);
            await feed.invalidateAllFeeds();
            showInfoBar("Post restored successfully", "success");
          } catch (error: any) {
            showInfoBar(error.message || "Failed to restore post", "error");
          }
        }
        break;
    }
  }, [undoAction, hideInfoBar, feed, showInfoBar]);

  // ==========================================================================
  // FEED NAVIGATION & REFRESH
  // ==========================================================================

  /**
   * Handles feed type switching
   */
  const handleFilterChange = useCallback(
    (filterId: string) => {
      if (token) feed.switchFeed(filterId as FeedType);
    },
    [token, feed],
  );

  /**
   * Handles pull-to-refresh action
   */
  const onRefresh = useCallback(() => {
    if (token) feed.refresh();
  }, [token, feed]);

  /**
   * Handles infinite scroll with throttle protection
   */
  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

      if (
        isCloseToBottom &&
        feed.currentFeed.hasMore &&
        !feed.currentFeed.loadingMore &&
        !loadingMorePosts
      ) {
        setLoadingMorePosts(true);
        feed.loadMore().finally(() => setLoadingMorePosts(false));
      }
    },
    [feed, loadingMorePosts],
  );

  // ==========================================================================
  // POST INTERACTION HANDLERS
  // ==========================================================================

  /**
   * Handles post like/unlike with optimistic update
   */
  const handleLike = useCallback(
    async (postId: string) => {
      if (!token) {
        showInfoBar("Please login to like posts", "info");
        return;
      }

      const post = visiblePosts.find((p) => p._id === postId);
      if (post) {
        feed.updatePost(postId, {
          isLiked: !post.isLiked,
          likeCount: post.isLiked ? post.likeCount - 1 : post.likeCount + 1,
        });
      }

      try {
        const response = await toggleLike(postId);
        feed.updatePost(postId, {
          isLiked: response.isLiked,
          likeCount: response.likes,
        });
      } catch (error: any) {
        if (error.isBlocked) {
          feed.removePost(postId);
          showInfoBar("You cannot interact with this post", "info");
          return;
        }
        if (post) {
          feed.updatePost(postId, {
            isLiked: post.isLiked,
            likeCount: post.likeCount,
          });
        }
        showInfoBar(error.message || "Failed to like post", "error");
      }
    },
    [token, visiblePosts, feed, showInfoBar],
  );

  /**
   * Navigates to comments screen
   */
  const handleComment = useCallback(
    (postId: string) => {
      if (!token) {
        showInfoBar("Please login to comment", "info");
        return;
      }
      router.push({
        pathname: "/components/Feed/Comment/CommentsScreen",
        params: { postId },
      });
    },
    [token, router, showInfoBar],
  );

  /**
   * Opens share modal for a post
   */
  const handleShare = useCallback(
    (postId: string) => {
      if (!token) {
        showInfoBar("Please login to share posts", "info");
        return;
      }
      const post = visiblePosts.find((p) => p._id === postId);
      if (post) {
        setSharePost(post);
        setShareModalVisible(true);
      }
    },
    [token, visiblePosts, showInfoBar],
  );

  /**
   * Navigates to user profile
   */
  const handleProfilePress = useCallback(
    (userId: string) => {
      if (!token || !userId) return;
      const targetRoute =
        userId === user?.id ? "/(tabs)/profile" : `/profile/${userId}`;
      router.push(targetRoute as any);
    },
    [token, user?.id, router],
  );

  /**
   * Navigates to edit post screen
   */
  const handleEditPost = useCallback(
    (postId: string) => {
      feed.markNeedsRefresh();
      router.push({
        pathname: "/components/Feed/Post/EditPost",
        params: { postId },
      });
    },
    [feed, router],
  );

  /**
   * Handles post deletion with undo option
   */
  const handleDeletePost = useCallback(
    async (postId: string) => {
      const postToDelete = visiblePosts.find((p) => p._id === postId);
      if (!postToDelete) return;

      feed.removePost(postId);
      showInfoBar(
        "Post deleted",
        "info",
        { type: "delete", postId, deletedPost: postToDelete },
        true,
      );

      try {
        await deletePost(postId);
        await feed.invalidateAllFeeds();
      } catch (error: any) {
        feed.addNewPost(postToDelete);
        hideInfoBar();
        showInfoBar(error.message || "Failed to delete post", "error");
      }
    },
    [visiblePosts, feed, showInfoBar, hideInfoBar],
  );

  /**
   * Handles post save/unsave with optimistic update
   */
  const handleSavePost = useCallback(
    async (postId: string) => {
      if (!token) {
        showInfoBar("Please login to save posts", "info");
        return;
      }

      const post = visiblePosts.find((p) => p._id === postId);
      const wasSaved = post?.isSaved;

      feed.updatePost(postId, { isSaved: !wasSaved });

      try {
        const response = await toggleSavePost(postId);
        feed.updatePost(postId, { isSaved: response.saved });

        if (response.saved) {
          showInfoBar("Post saved", "success", { type: "save", postId }, true);
        } else {
          showInfoBar("Post removed from saved", "info");
        }
      } catch (error: any) {
        if (error.isBlocked) {
          feed.updatePost(postId, { isSaved: wasSaved });
          showInfoBar("You cannot interact with this post", "info");
          return;
        }
        feed.updatePost(postId, { isSaved: wasSaved });
        showInfoBar(error.message || "Failed to save post", "error");
      }
    },
    [token, visiblePosts, feed, showInfoBar],
  );

  /**
   * Handles post hiding
   */
  const handleHidePost = useCallback(
    async (postId: string) => {
      if (!token) {
        showInfoBar("Please login to hide posts", "info");
        return;
      }

      feed.removePost(postId);
      showInfoBar("Post hidden", "info", { type: "hide", postId }, true);

      try {
        await hidePost(postId);
        await feed.invalidateAllFeeds();
      } catch (error: any) {
        if (error.isBlocked) {
          showInfoBar("You cannot interact with this post", "info");
          return;
        }
        await feed.invalidateAllFeeds();
        showInfoBar(error.message || "Failed to hide post", "error");
      }
    },
    [token, feed, showInfoBar],
  );

  /**
   * Handles post reporting flow
   */
  const handleReportPost = useCallback(
    (postId: string) => {
      if (!token) {
        showInfoBar("Please login to report posts", "info");
        return;
      }

      const post = visiblePosts.find((p) => p._id === postId);
      if (post?.isReported) {
        showInfoBar("You have already reported this post", "info");
        return;
      }

      setReportTargetId(postId);
      setReportTargetType("Post");
      setTimeout(() => setReportModalVisible(true), 300);
    },
    [token, visiblePosts, showInfoBar],
  );

  /**
   * Handles successful report submission
   */
  const handleReportSuccess = useCallback(() => {
    if (reportTargetType === "Post" && reportTargetId) {
      feed.updatePost(reportTargetId, { isReported: true });
    }
  }, [reportTargetType, reportTargetId, feed]);

  /**
   * Handles copy link action
   */
  const handleCopyLink = useCallback(() => {
    showInfoBar("Link copied to clipboard", "success");
  }, [showInfoBar]);

  /**
   * Handles muting a user
   */
  const handleMuteUser = useCallback(
    async (userId: string, userName?: string) => {
      if (!token || !userId) return;

      const postsToRemove = visiblePosts.filter((p) => p.user?._id === userId);
      postsToRemove.forEach((post) => feed.removePost(post._id));
      showInfoBar(
        `User ${userName || "user"} muted`,
        "info",
        { type: "mute", userId, userName },
        true,
      );

      try {
        await toggleMuteUser(userId);
        await feed.invalidateAllFeeds();
      } catch (error: any) {
        if (error.isBlocked) {
          showInfoBar(
            "Cannot mute this user due to block restrictions",
            "info",
          );
          return;
        }
        await feed.invalidateAllFeeds();
        showInfoBar(error.message || "Failed to mute user", "error");
      }
    },
    [token, visiblePosts, feed, showInfoBar],
  );

  /**
   * Handles blocking a user
   */
  const handleBlockUser = useCallback(
    async (userId: string, userName?: string) => {
      if (!token || !userId) return;

      const postsToRemove = visiblePosts.filter((p) => p.user?._id === userId);
      postsToRemove.forEach((post) => feed.removePost(post._id));
      showInfoBar(
        `User ${userName || "user"} blocked`,
        "info",
        { type: "block", userId, userName },
        true,
      );

      try {
        await toggleBlockUser(userId);
        await feed.invalidateAllFeeds();
      } catch (error: any) {
        await feed.invalidateAllFeeds();
        showInfoBar(error.message || "Failed to block user", "error");
      }
    },
    [token, visiblePosts, feed, showInfoBar],
  );

  /**
   * Creates a new post
   */
  const handleCreatePost = useCallback(() => {
    if (!token) {
      showInfoBar("Please login to create posts", "info");
      return;
    }
    feed.markNeedsRefresh();
    router.push("/components/Feed/Post/create");
  }, [token, feed, router, showInfoBar]);

  /**
   * Closes options modal
   */
  const handleOptionsModalClose = useCallback(() => {
    setIsOptionsModalOpen(false);
  }, []);

  /**
   * Opens options modal
   */
  const handleOptionsModalOpen = useCallback(() => {
    setIsOptionsModalOpen(true);
  }, []);

  /**
   * Closes report modal
   */
  const handleReportModalClose = useCallback(() => {
    setReportModalVisible(false);
  }, []);

  /**
   * Wrapper for report modal info bar
   */
  const handleReportShowInfoBar = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      showInfoBar(message, type);
    },
    [showInfoBar],
  );

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useFocusEffect(
    useCallback(() => {
      if (token) feed.refreshOnFocus();
    }, [token, feed]),
  );

  // ==========================================================================
  // RENDER HELPERS
  // ==========================================================================

  /**
   * Renders the info bar with undo functionality
   */
  const renderInfoBar = useCallback(() => {
    if (!infoMessage) return null;

    const backgroundColor =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : colors.primary;

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
  }, [
    infoMessage,
    infoType,
    colors.primary,
    slideAnim,
    undoAction,
    handleUndo,
  ]);

  /**
   * Renders the empty state when no posts are available
   */
  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyState}>
        <Ionicons name="newspaper-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
          No posts yet
        </Text>
        <Text style={[styles.emptyStateSubtext, { color: colors.textMuted }]}>
          {feed.activeFeed === "connections"
            ? "Connect with more people to see their posts"
            : "Be the first to share something on campus!"}
        </Text>
        <TouchableOpacity
          style={[
            styles.createFirstPostButton,
            { backgroundColor: colors.primary },
          ]}
          onPress={handleCreatePost}
        >
          <Text style={styles.createFirstPostText}>Create First Post</Text>
        </TouchableOpacity>
      </View>
    ),
    [colors, feed.activeFeed, handleCreatePost],
  );

  /**
   * Renders the error state when feed fails to load
   */
  const renderErrorState = useCallback(
    () => (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: isDark ? "#451a1a" : "#fee2e2" },
        ]}
      >
        <Text style={styles.errorText}>{feed.currentFeed.error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRefresh}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    ),
    [isDark, colors.primary, feed.currentFeed.error, onRefresh],
  );

  // ==========================================================================
  // CONDITIONAL RENDERING
  // ==========================================================================

  // Not logged in state
  if (!token) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centered}>
          <Ionicons name="log-in-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Please login to view the feed
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (feed.currentFeed.loading && visiblePosts.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <FeedSkeleton />
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.currentFeed.refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressBackgroundColor={colors.card}
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={400}
        contentContainerStyle={styles.scrollContent}
      >
        <MemoizedFeedHeader
          onProfilePress={() => router.push("/(tabs)/profile")}
        />
        <MemoizedCreatePostButton onPress={handleCreatePost} />
        <MemoizedFilterTabs
          filters={filters}
          activeFilter={feed.activeFeed}
          onFilterChange={handleFilterChange}
        />

        {feed.currentFeed.error &&
          visiblePosts.length === 0 &&
          renderErrorState()}

        <View style={styles.postsContainer}>
          {visiblePosts.length === 0 && !feed.currentFeed.loading
            ? renderEmptyState()
            : visiblePosts.map((post) => (
                <MemoizedPostCard
                  key={post._id}
                  post={post}
                  onLikePress={handleLike}
                  onCommentPress={handleComment}
                  onSharePress={handleShare}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                  onSave={handleSavePost}
                  onReport={handleReportPost}
                  onHide={handleHidePost}
                  onCopyLink={handleCopyLink}
                  onMuteUser={(userId: string) =>
                    handleMuteUser(
                      userId,
                      post.user?.name || post.user?.username,
                    )
                  }
                  onBlockUser={(userId: string) =>
                    handleBlockUser(
                      userId,
                      post.user?.name || post.user?.username,
                    )
                  }
                  onProfilePress={handleProfilePress}
                  onOptionsOpen={handleOptionsModalOpen}
                  onOptionsClose={handleOptionsModalClose}
                />
              ))}
        </View>

        {loadingMorePosts && <LoadMorePostsSkeleton />}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Share Modal */}
      {sharePostData && (
        <MemoizedSharePostModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setTimeout(() => setSharePost(null), 300);
          }}
          onSuccess={() => showInfoBar("Post shared successfully", "success")}
          {...sharePostData}
        />
      )}

      {/* Report Modal */}
      <MemoizedReportModal
        visible={reportModalVisible}
        onClose={handleReportModalClose}
        targetType={reportTargetType}
        targetId={reportTargetId}
        onReportSuccess={handleReportSuccess}
        onShowInfoBar={handleReportShowInfoBar}
        reportFunction={(targetId: string, reason: string) =>
          reportContent(reportTargetType, targetId, reason)
        }
      />

      {/* Info Bar */}
      {renderInfoBar()}
    </SafeAreaView>
  );
}
