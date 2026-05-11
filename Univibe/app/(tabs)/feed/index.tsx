// app/(tabs)/feed/index.tsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../lib/contexts/AuthContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import FeedHeader from "@/app/components/Feed/FeedHeader";
import CreatePostButton from "@/app/components/Feed/Post/CreatePostButton";
import FilterTabs from "@/app/components/Feed/FilterTabs";
import PostCard from "@/app/components/Feed/Post/PostCard";
import SharePostModal from "@/app/components/Feed/Post/SharePostModal";
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
} from "../../../lib/services/contentService";

import { useFeed } from "../../../hooks/useFeed";

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

  const {
    activeFeed,
    currentFeed,
    switchFeed,
    refresh: refreshFeed,
    loadMore: loadMoreFeed,
    addNewPost,
    removePost,
    updatePost,
    refreshOnFocus,
    markNeedsRefresh,
    invalidateAllFeeds,
  } = useFeed();

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePost, setSharePost] = useState<Post | null>(null);

  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const filters = [
    { id: "campus", label: "Campus" },
    { id: "connections", label: "Connections" },
    { id: "anonymous", label: "Anonymous" },
  ];

  const visiblePosts = currentFeed.posts;

  useFocusEffect(
    useCallback(() => {
      if (token) {
        refreshOnFocus();
      }
    }, [token, refreshOnFocus]),
  );

  const showInfoBar = (
    message: string,
    type: "success" | "error" | "info" = "info",
    action?: UndoAction,
    autoHide = true,
  ) => {
    setInfoMessage(message);
    setInfoType(type);
    setUndoAction(action || null);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

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

    if (autoHide) {
      undoTimeoutRef.current = setTimeout(() => {
        setInfoMessage(null);
        setUndoAction(null);
        slideAnim.setValue(100);
      }, 5000);
    }
  };

  const hideInfoBar = () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
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

  const handleUndo = async () => {
    if (!undoAction) return;

    switch (undoAction.type) {
      case "mute":
        if (undoAction.userId) {
          await toggleMuteUser(undoAction.userId);
          await invalidateAllFeeds();
          showInfoBar(
            `User ${undoAction.userName || "muted"} unmuted`,
            "success",
          );
        }
        break;
      case "block":
        if (undoAction.userId) {
          await toggleBlockUser(undoAction.userId);
          await invalidateAllFeeds();
          showInfoBar(
            `User ${undoAction.userName || "blocked"} unblocked`,
            "success",
          );
        }
        break;
      case "hide":
        if (undoAction.postId) {
          await unhidePost(undoAction.postId);
          await invalidateAllFeeds();
          showInfoBar("Post restored to feed", "success");
        }
        break;
      case "save":
        if (undoAction.postId) {
          await toggleSavePost(undoAction.postId);
          updatePost(undoAction.postId, { isSaved: false });
          showInfoBar("Post removed from saved items", "info");
        }
        break;
      case "delete":
        if (undoAction.postId && undoAction.deletedPost) {
          try {
            await restorePost(undoAction.postId);
            addNewPost(undoAction.deletedPost);
            await invalidateAllFeeds();
            showInfoBar("Post restored successfully", "success");
          } catch (error: any) {
            showInfoBar(error.message || "Failed to restore post", "error");
          }
        }
        break;
    }
    hideInfoBar();
  };

  const handleFilterChange = (filterId: string) => {
    if (token) switchFeed(filterId as "campus" | "connections" | "anonymous");
  };

  const onRefresh = useCallback(() => {
    if (token) refreshFeed();
  }, [token, refreshFeed]);

  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
      if (
        isCloseToBottom &&
        currentFeed.hasMore &&
        !currentFeed.loadingMore &&
        !loadingMorePosts
      ) {
        setLoadingMorePosts(true);
        loadMoreFeed().finally(() => {
          setLoadingMorePosts(false);
        });
      }
    },
    [
      currentFeed.hasMore,
      currentFeed.loadingMore,
      loadMoreFeed,
      loadingMorePosts,
    ],
  );

  const handleLike = async (postId: string) => {
    if (!token) {
      showInfoBar("Please login to like posts", "info");
      return;
    }

    const post = visiblePosts.find((p) => p._id === postId);
    if (post) {
      updatePost(postId, {
        isLiked: !post.isLiked,
        likeCount: post.isLiked ? post.likeCount - 1 : post.likeCount + 1,
      });
    }

    try {
      const response = await toggleLike(postId);
      updatePost(postId, {
        isLiked: response.isLiked,
        likeCount: response.likes,
      });
    } catch (error: any) {
      if (error.isBlocked) {
        removePost(postId);
        showInfoBar("You cannot interact with this post", "info");
        return;
      }
      if (post)
        updatePost(postId, {
          isLiked: post.isLiked,
          likeCount: post.likeCount,
        });
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

  const handleShare = (postId: string) => {
    if (!token) {
      showInfoBar("Please login to share posts", "info");
      return;
    }
    const post = visiblePosts.find((p) => p._id === postId);
    if (post) {
      setSharePost(post);
      setShareModalVisible(true);
    }
  };

  const handleProfilePress = (userId: string) => {
    if (!token || !userId) return;
    router.push(userId === user?.id ? "/(tabs)/profile" : `/profile/${userId}`);
  };

  const handleEditPost = (postId: string) => {
    markNeedsRefresh();
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  };

  const handleDeletePost = async (postId: string) => {
    const postToDelete = visiblePosts.find((p) => p._id === postId);
    if (!postToDelete) return;

    removePost(postId);
    showInfoBar(
      "Post deleted",
      "info",
      { type: "delete", postId, deletedPost: postToDelete },
      true,
    );

    try {
      await deletePost(postId);
      await invalidateAllFeeds();
    } catch (error: any) {
      addNewPost(postToDelete);
      showInfoBar(error.message || "Failed to delete post", "error");
    }
  };

  const handleSavePost = async (postId: string) => {
    if (!token) {
      showInfoBar("Please login to save posts", "info");
      return;
    }

    const post = visiblePosts.find((p) => p._id === postId);
    const wasSaved = post?.isSaved;

    updatePost(postId, { isSaved: !wasSaved });

    try {
      const response = await toggleSavePost(postId);
      updatePost(postId, { isSaved: response.saved });

      if (response.saved) {
        showInfoBar("Post saved", "success", { type: "save", postId }, true);
      } else {
        showInfoBar("Post removed from saved", "info");
      }
    } catch (error: any) {
      if (error.isBlocked) {
        updatePost(postId, { isSaved: wasSaved });
        showInfoBar("You cannot interact with this post", "info");
        return;
      }
      updatePost(postId, { isSaved: wasSaved });
      showInfoBar(error.message || "Failed to save post", "error");
    }
  };

  const handleReportPost = () => {
    Alert.alert(
      "Report Post",
      "We'll review this post and take appropriate action.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: () => showInfoBar("Thank you for reporting", "success"),
        },
      ],
    );
  };

  const handleHidePost = async (postId: string) => {
    if (!token) {
      showInfoBar("Please login to hide posts", "info");
      return;
    }

    removePost(postId);
    showInfoBar("Post hidden", "info", { type: "hide", postId }, true);

    try {
      await hidePost(postId);
      await invalidateAllFeeds();
    } catch (error: any) {
      if (error.isBlocked) {
        showInfoBar("You cannot interact with this post", "info");
        return;
      }
      await invalidateAllFeeds();
      showInfoBar(error.message || "Failed to hide post", "error");
    }
  };

  const handleCopyLink = () => {
    showInfoBar("Link copied to clipboard", "success");
  };

  const handleMuteUser = async (userId: string, userName?: string) => {
    if (!token || !userId) return;

    const postsToRemove = visiblePosts.filter((p) => p.user?._id === userId);
    postsToRemove.forEach((post) => removePost(post._id));
    showInfoBar(
      `User ${userName || "muted"} muted`,
      "info",
      { type: "mute", userId, userName },
      true,
    );

    try {
      await toggleMuteUser(userId);
      await invalidateAllFeeds();
    } catch (error: any) {
      if (error.isBlocked) {
        showInfoBar("Cannot mute this user due to block restrictions", "info");
        return;
      }
      await invalidateAllFeeds();
      showInfoBar(error.message || "Failed to mute user", "error");
    }
  };

  const handleBlockUser = async (userId: string, userName?: string) => {
    if (!token || !userId) return;

    const postsToRemove = visiblePosts.filter((p) => p.user?._id === userId);
    postsToRemove.forEach((post) => removePost(post._id));
    showInfoBar(
      `User ${userName || "blocked"} blocked`,
      "info",
      { type: "block", userId, userName },
      true,
    );

    try {
      await toggleBlockUser(userId);
      await invalidateAllFeeds();
    } catch (error: any) {
      await invalidateAllFeeds();
      showInfoBar(error.message || "Failed to block user", "error");
    }
  };

  const handleCreatePost = () => {
    if (!token) {
      showInfoBar("Please login to create posts", "info");
      return;
    }
    markNeedsRefresh();
    router.push("/components/Feed/Post/create");
  };

  const renderInfoBar = () => {
    if (!infoMessage) return null;
    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : "#8b5cf6";
    const icon =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";

    return (
      <Animated.View
        style={[
          styles.infoBar,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.infoBarText}>{infoMessage}</Text>
        {undoAction && (
          <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
            <Text style={styles.undoButtonText}>UNDO</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const sharePostData = sharePost
    ? {
        postId: sharePost._id,
        postContent: sharePost.content || "",
        postImage: sharePost.images?.[0]?.url
          ? getFullImageUrl(sharePost.images[0].url)
          : "",
        postAuthorName: sharePost.isAnonymous
          ? "Anonymous"
          : sharePost.user?.name || "Unknown",
        postAuthorAvatar: sharePost.user?.profilePicture || "",
        isAnonymous: sharePost.isAnonymous || false,
      }
    : null;

  if (!token) {
    return (
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
  }

  if (currentFeed.loading && visiblePosts.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <FeedSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={currentFeed.refreshing}
            onRefresh={onRefresh}
            colors={["#8b5cf6"]}
            tintColor="#8b5cf6"
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={400}
        contentContainerStyle={styles.scrollContent}
      >
        <FeedHeader onProfilePress={() => router.push("/(tabs)/profile")} />
        <CreatePostButton onPress={handleCreatePost} />
        <FilterTabs
          filters={filters}
          activeFilter={activeFeed}
          onFilterChange={handleFilterChange}
        />

        {currentFeed.error && visiblePosts.length === 0 && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{currentFeed.error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.postsContainer}>
          {visiblePosts.length === 0 && !currentFeed.loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No posts yet</Text>
              <Text style={styles.emptyStateSubtext}>
                {activeFeed === "connections"
                  ? "Connect with more people to see their posts"
                  : "Be the first to share something on campus!"}
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
            visiblePosts.map((post) => (
              <PostCard
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
                onMuteUser={(userId) =>
                  handleMuteUser(userId, post.user?.name || post.user?.username)
                }
                onBlockUser={(userId) =>
                  handleBlockUser(
                    userId,
                    post.user?.name || post.user?.username,
                  )
                }
                onProfilePress={handleProfilePress}
              />
            ))
          )}
        </View>

        {loadingMorePosts && <LoadMorePostsSkeleton />}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {renderInfoBar()}

      {sharePostData && (
        <SharePostModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setTimeout(() => setSharePost(null), 300);
          }}
          onSuccess={() => showInfoBar("Post shared successfully", "success")}
          {...sharePostData}
        />
      )}
    </SafeAreaView>
  );
}
