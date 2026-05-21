// app/post/[id].tsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext"; 
import PostDetailSkeleton from "@/app/components/Feed/Post/PostDetailSkeleton";
import {
  getPostById,
  getPostComments,
  toggleLike,
  deletePost,
  Post,
  Comment,
  getFullImageUrl,
} from "@/lib/services/postService";
import PostPreview from "@/app/components/Feed/Comment/PostPreview";
import CommentItem from "@/app/components/Feed/Comment/CommentItem";
import CommentInput from "@/app/components/Feed/Comment/CommentInput";
import ImageModal from "@/app/components/Feed/Comment/ImageModal";
import useComments from "@/app/components/Feed/Comment/useComments";

const { width: screenWidth } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id, openComments } = useLocalSearchParams<{
    id: string;
    openComments?: string;
  }>();
  const router = useRouter();
  const { token, user } = useAuth();

  // ✅ Tap straight into your global context tokens
  const { isDark, colors } = useTheme();

  // Post state
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPostLiked, setIsPostLiked] = useState(false);
  const [postLikesCount, setPostLikesCount] = useState(0);

  // Image modal state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAnyCommentEditing, setIsAnyCommentEditing] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const isFetchingRef = useRef(false);
  const isLikingRef = useRef(false);

  // Comments Hook Integration
  const {
    submitting,
    replyingTo,
    setReplyingTo,
    handleSubmit: submitComment,
    handleLike: commentLikeHandler,
    handleDelete: commentDeleteHandler,
    handleReport: commentReportHandler,
    handleEdit: commentEditHandler,
  } = useComments(id, comments, setComments, setTotalComments, setPost, user);

  // Dynamic context-based system overlays
  const alertStyles = useMemo(
    () => ({
      errorBg: isDark ? "#2c1a1a" : "#fee2e2",
      warningBg: isDark ? "#2d2214" : "#fef3c7",
    }),
    [isDark],
  );

  // ===== Post Loading =====
  const loadPost = useCallback(async () => {
    if (!id) {
      setError("Invalid post ID");
      setLoading(false);
      return;
    }

    try {
      const response = await getPostById(id);
      if (response.success && response.post) {
        setPost(response.post);
        setIsPostLiked(response.post.isLiked || false);
        setPostLikesCount(response.post.likes?.length || 0);
        setError(null);
      } else {
        setError("Post not found or has been deleted");
      }
    } catch (error: any) {
      console.error("Error loading post:", error);
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
  }, [id]);

  // ===== Comments Loading =====
  const loadComments = useCallback(
    async (pageNum = 1, shouldAppend = false) => {
      if (error && error.includes("no longer exists")) return;
      if (isFetchingRef.current && pageNum > 1) return;

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
          setTotalComments(response.pagination?.total || newComments.length);
          setHasMore(response.pagination?.pages > pageNum);
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
      } finally {
        if (shouldAppend) {
          setIsLoadingMore(false);
        }
      }
    },
    [id, error, openComments],
  );

  // ===== Post Actions =====
  const handlePostLike = useCallback(async () => {
    if (isLikingRef.current || !token || !post) return;

    isLikingRef.current = true;
    const newLikedState = !isPostLiked;
    setIsPostLiked(newLikedState);
    setPostLikesCount((prev) => (newLikedState ? prev + 1 : prev - 1));

    try {
      const response = await toggleLike(id);
      setIsPostLiked(response.isLiked);
      setPostLikesCount(response.likes);
    } catch (error: any) {
      setIsPostLiked(!newLikedState);
      setPostLikesCount((prev) => (newLikedState ? prev - 1 : prev + 1));
    } finally {
      isLikingRef.current = false;
    }
  }, [token, post, isPostLiked, id]);

  const handleCommentReply = useCallback(
    (
      commentId: string,
      displayName: string,
      username: string,
      isAnonymousReply: boolean = false,
    ) => {
      setReplyingTo({
        commentId,
        username: displayName,
        mentionUsername: username,
        isAnonymous: isAnonymousReply,
      });
      setCommentText(`@${username} `);
      setIsAnonymous(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
    [setReplyingTo],
  );

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setCommentText("");
    setIsAnonymous(false);
  }, [setReplyingTo]);

  const onSubmitComment = useCallback(() => {
    submitComment(commentText, isAnonymous, () => {
      setCommentText("");
      setReplyingTo(null);
      setIsAnonymous(false);
    });
  }, [commentText, isAnonymous, submitComment, setReplyingTo]);

  const handleImagePress = useCallback((index: number) => {
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  }, []);

  const handleModalScroll = useCallback((event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setSelectedImageIndex(index);
  }, []);

  const loadMoreComments = useCallback(() => {
    if (hasMore && !isLoadingMore && comments.length > 0 && !error) {
      loadComments(page + 1, true);
    }
  }, [hasMore, isLoadingMore, comments.length, error, page, loadComments]);

  // ===== Effects =====
  useEffect(() => {
    if (token && id) {
      setLoading(true);
      setError(null);
      loadPost();
    } else if (!token) {
      setLoading(false);
      setError("Please login to view this post");
    }
  }, [id, token, loadPost]);

  useEffect(() => {
    if (post && !error) {
      loadComments(1, false);
    }
  }, [post, error, loadComments]);

  // ===== Render Functions =====
  const renderCommentItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        postId={post?._id || ""}
        postAuthorId={post?.user?._id || ""}
        isAnonymousPost={post?.isAnonymous || false}
        onReply={handleCommentReply}
        onLike={commentLikeHandler}
        onUpdate={commentEditHandler}
        onDelete={commentDeleteHandler}
        onReport={commentReportHandler}
        currentUserId={user?.id || ""}
        onEditStateChange={setIsAnyCommentEditing}
      />
    ),
    [
      post?._id,
      post?.user?._id,
      post?.isAnonymous,
      user?.id,
      handleCommentReply,
      commentLikeHandler,
      commentEditHandler,
      commentDeleteHandler,
      commentReportHandler,
    ],
  );

  const renderPostHeader = useMemo(() => {
    if (!post) return null;
    return (
      <PostPreview
        post={post}
        isLiked={isPostLiked}
        likesCount={postLikesCount}
        onLikePress={handlePostLike}
        onImagePress={handleImagePress}
      />
    );
  }, [post, isPostLiked, postLikesCount, handlePostLike, handleImagePress]);

  const renderFooterLoader = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
    );
  }, [isLoadingMore, colors.primary]);

  const renderEmptyComments = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="chatbubbles-outline"
          size={48}
          color={colors.textMuted}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          No comments yet
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Be the first to comment!
        </Text>
      </View>
    );
  }, [loading, colors]);

  // ===== Error & Loading States =====
  if (
    error &&
    (error.includes("no longer exists") || error.includes("deleted"))
  ) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.errorIconCircle,
              { backgroundColor: alertStyles.errorBg },
            ]}
          >
            <Ionicons name="alert" size={60} color="#ef4444" />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Post Not Found
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text }]}>
            {error}
          </Text>
          <Text style={[styles.errorSubtext, { color: colors.textSecondary }]}>
            This post may have been deleted by the author or removed for
            violating our guidelines.
          </Text>
          <TouchableOpacity
            style={[styles.goBackButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return <PostDetailSkeleton />;
  }

  if (error || !post) {
    const isNoContent = !post && !error;
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.errorIconCircle,
              {
                backgroundColor: isNoContent
                  ? colors.border
                  : alertStyles.warningBg,
              },
            ]}
          >
            <Ionicons
              name={
                isNoContent ? "document-text-outline" : "alert-circle-outline"
              }
              size={60}
              color={isNoContent ? colors.textMuted : "#f59e0b"}
            />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            {isNoContent ? "No Content" : "Something Went Wrong"}
          </Text>
          <Text style={[styles.errorMessage, { color: colors.text }]}>
            {isNoContent ? "Unable to load post content" : error}
          </Text>
          <TouchableOpacity
            style={[styles.goBackButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back-outline" size={20} color="#fff" />
            <Text style={styles.goBackButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const postImages =
    post.images?.map((img) => ({ url: getFullImageUrl(img.url) })) || [];

  // ===== Architectural Layout Engine =====
  return (
    <KeyboardAvoidingView
      style={[styles.keyboardView, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top", "left", "right"]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.background, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Comments Stream */}
        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderCommentItem}
          ListHeaderComponent={renderPostHeader}
          ListEmptyComponent={renderEmptyComments}
          ListFooterComponent={renderFooterLoader}
          onEndReached={loadMoreComments}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="always"
        />

        {/* Floating Input Controller */}
        {!isAnyCommentEditing && (
          <CommentInput
            ref={inputRef}
            value={commentText}
            onChangeText={setCommentText}
            onSubmit={onSubmitComment}
            isAnonymous={isAnonymous}
            onAnonymousToggle={() => setIsAnonymous(!isAnonymous)}
            isSubmitting={submitting}
            replyingTo={replyingTo}
            onCancelReply={handleCancelReply}
            placeholder="Write a comment..."
          />
        )}

        {/* Photo View Modals */}
        {imageModalVisible && postImages.length > 0 && (
          <ImageModal
            visible={imageModalVisible}
            onClose={() => setImageModalVisible(false)}
            images={postImages}
            selectedIndex={selectedImageIndex}
            onScroll={handleModalScroll}
          />
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 12,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
    paddingHorizontal: 20,
    fontStyle: "italic",
  },
  goBackButton: {
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
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  listContent: {
    flexGrow: 1,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  footerLoader: {
    paddingVertical: 20,
  },
});
