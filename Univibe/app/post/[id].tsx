// app/post/[id].tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/AuthContext";
import {
  getPostById,
  getPostComments,
  addComment,
  addReply,
  toggleLike,
  toggleCommentLike,
  deleteComment,
  updateComment,
  deletePost,
  Post,
  Comment,
} from "../../lib/postService";
import PostCard from "../components/Feed/Post/PostCard";
import CommentItem from "../components/Feed/Comment/CommentItem";
import CommentInput from "../components/Feed/Comment/CommentInput";

export default function PostDetailScreen() {
  const { id, openComments } = useLocalSearchParams<{
    id: string;
    openComments?: string;
  }>();
  const router = useRouter();
  const { token, user, profile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
    mentionUsername: string;
    isAnonymous: boolean;
  } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);

  const loadPost = async () => {
    if (!id) {
      setError("Invalid post ID");
      setLoading(false);
      return;
    }

    try {
      const response = await getPostById(id);
      if (response.success && response.post) {
        setPost(response.post);
        setError(null);
      } else {
        setError("Post not found or has been deleted");
      }
    } catch (error: any) {
      console.error("Error loading post:", error);
      // Check if it's a 404 error
      if (
        error.message?.includes("404") ||
        error.message?.includes("Failed to fetch post: 404")
      ) {
        setError("This post no longer exists or has been deleted.");
      } else {
        setError("Failed to load post. Please check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (pageNum = 1, shouldAppend = false) => {
    // Don't try to load comments if post doesn't exist
    if (error && error.includes("no longer exists")) return;
    if (isLoadingMore) return;

    if (shouldAppend) {
      setIsLoadingMore(true);
    }

    try {
      const response = await getPostComments(id, pageNum, 20);
      if (response.success) {
        const newComments = response.comments;
        setComments((prev) =>
          shouldAppend ? [...prev, ...newComments] : newComments,
        );
        setHasMore(response.pagination.pages > pageNum);
        setPage(pageNum);

        if (
          openComments === "true" &&
          pageNum === 1 &&
          newComments.length > 0
        ) {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: 0, animated: true });
          }, 500);
        }
      }
    } catch (error: any) {
      console.error("Error loading comments:", error);
      // Don't set error state for comments, just log it
    } finally {
      if (shouldAppend) {
        setIsLoadingMore(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    if (error && error.includes("no longer exists")) {
      Alert.alert("Error", "Cannot comment on a post that no longer exists");
      return;
    }

    setSubmitting(true);
    try {
      if (replyingTo) {
        await addReply(
          id,
          replyingTo.commentId,
          commentText.trim(),
          isAnonymous,
        );
      } else {
        await addComment(id, commentText.trim(), isAnonymous);
      }

      setCommentText("");
      setReplyingTo(null);
      setIsAnonymous(false);
      await loadComments(1, false);

      // Update post comment count
      setPost((prev) =>
        prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null,
      );

      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: true });
      }, 300);
    } catch (error) {
      Alert.alert("Error", "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!post) return;
    try {
      const response = await toggleLike(post._id);
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likes: response.isLiked
                ? [...(prev.likes || []), { _id: user?.id }]
                : prev.likes?.filter((like: any) => like._id !== user?.id),
              isLiked: response.isLiked,
            }
          : null,
      );
    } catch (error) {
      Alert.alert("Error", "Failed to like post");
    }
  };

  const handleEditPost = () => {
    router.push(`/post/edit/${post?._id}`);
  };

  const handleDeletePost = async () => {
    if (!post) return;

    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePost(post._id);
              Alert.alert("Success", "Post deleted successfully");
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete post");
            }
          },
        },
      ],
    );
  };

  const handleRepost = async () => {
    if (!post) return;
    Alert.alert("Coming Soon", "Repost feature coming soon!");
  };

  const handleShare = async () => {
    if (!post) return;

    try {
      await Share.share({
        message: `${post.content}\n\nCheck out this post on Univibe!`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share post");
    }
  };

  const handleSavePost = () => {
    Alert.alert("Saved", "Post saved to your bookmarks");
  };

  const handleReportPost = () => {
    Alert.alert(
      "Report Submitted",
      "Thank you for reporting this post. Our team will review it.",
    );
  };

  const handleHidePost = () => {
    Alert.alert("Post Hidden", "You won't see this post anymore");
    router.back();
  };

  const handleCopyLink = () => {
    Alert.alert("Link Copied", "Post link copied to clipboard");
  };

  const handleMuteUser = () => {
    Alert.alert("User Muted", "You won't see posts from this user anymore");
    router.back();
  };

  const handleBlockUser = () => {
    Alert.alert("User Blocked", "You won't see posts from this user anymore");
    router.back();
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      const response = await toggleCommentLike(id, commentId);
      setComments((prev) =>
        prev.map((comment) =>
          comment._id === commentId
            ? {
                ...comment,
                likes: response.isLiked
                  ? [...(comment.likes || []), user?.id || ""]
                  : comment.likes?.filter((like) => like !== user?.id),
                isLiked: response.isLiked,
                likeCount: response.likes,
              }
            : comment,
        ),
      );
    } catch (error) {
      Alert.alert("Error", "Failed to like comment");
    }
  };

  const handleCommentUpdate = async (commentId: string, content: string) => {
    try {
      const response = await updateComment(id, commentId, content);
      if (response.success) {
        setComments((prev) =>
          prev.map((comment) =>
            comment._id === commentId
              ? {
                  ...comment,
                  content: response.comment.content,
                  isEdited: true,
                }
              : comment,
          ),
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update comment");
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await deleteComment(id, commentId);
              if (response.success) {
                setComments((prev) => prev.filter((c) => c._id !== commentId));
                setPost((prev) =>
                  prev
                    ? { ...prev, commentCount: (prev.commentCount || 1) - 1 }
                    : null,
                );
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete comment");
            }
          },
        },
      ],
    );
  };

  const handleCommentReport = async (commentId: string) => {
    Alert.alert("Report", "Report submitted. We'll review it shortly.");
  };

  const handleCommentReply = (
    commentId: string,
    displayName: string,
    username: string,
    isAnonymous: boolean = false,
  ) => {
    setReplyingTo({
      commentId,
      username: displayName,
      mentionUsername: username,
      isAnonymous,
    });
    setCommentText(`@${username} `);
    setIsAnonymous(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText("");
    setIsAnonymous(false);
  };

  const handleAnonymousToggle = () => {
    setIsAnonymous(!isAnonymous);
  };

  const loadMoreComments = () => {
    if (hasMore && !isLoadingMore && comments.length > 0 && !error) {
      loadComments(page + 1, true);
    }
  };

  useEffect(() => {
    if (token && id) {
      setLoading(true);
      setError(null);
      loadPost();
    } else if (!token) {
      setLoading(false);
      setError("Please login to view this post");
    }
  }, [id, token]);

  // Load comments only after post is successfully loaded
  useEffect(() => {
    if (post && !error) {
      loadComments(1, false);
    }
  }, [post]);

  const renderFooterLoader = () => {
    if (!isLoadingMore) return null;
    return <ActivityIndicator style={styles.footerLoader} color="#8b5cf6" />;
  };

  const renderCommentItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        postId={post?._id || ""}
        postAuthorId={post?.user._id || ""}
        isAnonymousPost={post?.isAnonymous || false}
        onReply={handleCommentReply}
        onLike={handleCommentLike}
        onUpdate={handleCommentUpdate}
        onDelete={handleCommentDelete}
        onReport={handleCommentReport}
        currentUserId={user?.id || ""}
        onEditStateChange={() => {}}
      />
    ),
    [post, user?.id],
  );

  // Show error state for deleted/missing post
  if (
    error &&
    (error.includes("no longer exists") || error.includes("deleted"))
  ) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert" size={60} color="#ef4444" />
          </View>
          <Text style={styles.errorTitle}>Post Not Found</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <Text style={styles.errorSubtext}>
            This post may have been deleted by the author or removed for violating our guidelines.
          </Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    );
  }

  // Show other errors
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconCircle, styles.warningIconCircle]}>
            <Ionicons name="alert-circle-outline" size={60} color="#f59e0b" />
          </View>
          <Text style={styles.errorTitle}>Something Went Wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#fff" />
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={[styles.errorIconCircle, styles.warningIconCircle]}>
            <Ionicons name="document-text-outline" size={60} color="#9ca3af" />
          </View>
          <Text style={styles.errorTitle}>No Content</Text>
          <Text style={styles.errorMessage}>Unable to load post content</Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#fff" />
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderCommentItem}
          ListHeaderComponent={
            <View style={styles.postContainer}>
              <PostCard
                post={post}
                onLikePress={handleLike}
                onCommentPress={() => {}}
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
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>
                  Comments ({post.commentCount || 0})
                </Text>
              </View>
            </View>
          }
          ListFooterComponent={renderFooterLoader()}
          onEndReached={loadMoreComments}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        />

        <CommentInput
          ref={inputRef}
          value={commentText}
          onChangeText={setCommentText}
          onSubmit={handleSubmit}
          isAnonymous={isAnonymous}
          onAnonymousToggle={handleAnonymousToggle}
          isSubmitting={submitting}
          replyingTo={replyingTo}
          onCancelReply={handleCancelReply}
          placeholder="Write a comment..."
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  errorIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  warningIconCircle: {
    backgroundColor: "#fef3c7",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: "#3a3a3c",
    textAlign: "center",
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    color: "#929292",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 20,
    fontStyle: "italic",
  },
  goBackButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goBackButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  postContainer: {
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  commentsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  footerLoader: {
    paddingVertical: 20,
  },
});