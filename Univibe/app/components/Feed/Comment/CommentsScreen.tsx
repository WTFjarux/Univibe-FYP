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
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/contexts/AuthContext";

// Components
import CommentHeader from "./CommentHeader";
import PostPreview from "./PostPreview";
import CommentItem from "./CommentItem";
import CommentInput from "./CommentInput";
import ImageModal from "./ImageModal";

// Hooks
import useComments from "./useComments";

// Services
import {
  getPostById,
  getPostComments,
  getFullImageUrl,
  toggleLike,
  Post,
  Comment,
} from "@/lib/services/postService";

const { width: screenWidth } = Dimensions.get("window");

/**
 * Ensures comments are properly typed by handling the replies union type
 */
const assertComments = (comments: any[]): Comment[] => {
  return comments.map((comment) => ({
    ...comment,
    depth: comment.depth ?? 1,
    replies: Array.isArray(comment.replies)
      ? comment.replies.length > 0 && typeof comment.replies[0] === "object"
        ? (comment.replies as Comment[])
        : (comment.replies as string[])
      : [],
  })) as Comment[];
};

/**
 * Main comments screen component
 * Displays a post and its threaded comments with full CRUD functionality
 */
export default function CommentScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user, token } = useAuth();

  // ===== State =====
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalComments, setTotalComments] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [isAnyCommentEditing, setIsAnyCommentEditing] = useState(false);

  // Post like state
  const [isPostLiked, setIsPostLiked] = useState(false);
  const [postLikesCount, setPostLikesCount] = useState(0);

  // ===== Refs =====
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);

  // ===== Custom Hooks =====
  const {
    submitting,
    replyingTo,
    setReplyingTo,
    handleSubmit,
    handleLike,
    handleDelete,
    handleReport,
    handleEdit,
  } = useComments(
    postId,
    comments,
    setComments,
    setTotalComments,
    setPost,
    user,
  );

  // ===== Data Fetching =====
  const fetchPostDetails = async () => {
    try {
      const response = await getPostById(postId);
      setPost(response.post);
      setIsPostLiked(response.post.isLiked || false);
      setPostLikesCount(response.post.likes?.length || 0);
    } catch (error) {
      console.error("Error fetching post:", error);
      Alert.alert("Error", "Failed to load post details");
    }
  };

  const fetchComments = async (pageNum = 1, refresh = false) => {
    try {
      const response = await getPostComments(postId, pageNum, 20);
      const typedComments = assertComments(response.comments);

      if (refresh || pageNum === 1) {
        setComments(typedComments);
      } else {
        setComments((prev) => [...prev, ...typedComments]);
      }

      setHasMore(response.pagination?.pages > pageNum);
      setTotalComments(response.totalComments);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      Alert.alert("Error", error.message || "Failed to load comments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ===== Effects =====
  useEffect(() => {
    if (postId && token) {
      Promise.all([fetchPostDetails(), fetchComments(1, true)]);
    } else if (!token) {
      setLoading(false);
      Alert.alert("Login Required", "Please login to view comments", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [postId, token]);

  // ===== Handlers =====
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
    fetchPostDetails();
    fetchComments(1, true);
  }, []);

  const loadMore = () => {
    if (!loading && hasMore && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchComments(nextPage);
    }
  };

  const handlePostLike = async () => {
    if (!token || !post) return;

    try {
      // Optimistically update UI
      const newLikedState = !isPostLiked;
      setIsPostLiked(newLikedState);
      setPostLikesCount((prev) => (newLikedState ? prev + 1 : prev - 1));

      // Call API to toggle like
      const response = await toggleLike(postId);

      // Update with actual response
      setIsPostLiked(response.isLiked);
      setPostLikesCount(response.likes);

      // Update the post object
      setPost((prev) =>
        prev
          ? {
              ...prev,
              isLiked: response.isLiked,
              likes: response.isLiked
                ? [...(prev.likes || []), { _id: user?.id }]
                : (prev.likes || []).filter(
                    (like: any) => like._id !== user?.id,
                  ),
            }
          : null,
      );
    } catch (error: any) {
      console.error("Error liking post:", error);
      // Revert on error
      setIsPostLiked(!isPostLiked);
      setPostLikesCount((prev) => (isPostLiked ? prev + 1 : prev - 1));
      Alert.alert("Error", error.message || "Failed to like post");
    }
  };

  const handleReplyPress = (
    commentId: string,
    displayName: string,
    username: string,
  ) => {
    setReplyingTo({
      commentId,
      username: displayName,
      mentionUsername: username,
      isAnonymous: false,
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

  const onSubmitComment = () => {
    handleSubmit(commentText, isAnonymous, () => {
      setCommentText("");
      setReplyingTo(null);
      setIsAnonymous(false);
      Keyboard.dismiss();
    });
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageModalVisible(true);
  };

  const handleModalScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setSelectedImageIndex(index);
  };

  // ===== Render Helpers =====
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
  }, [post, isPostLiked, postLikesCount]);

  const renderCommentItem = useCallback(
    ({ item }: { item: Comment }) => (
      <CommentItem
        comment={item}
        postId={postId}
        postAuthorId={post?.user?._id || ""}
        isAnonymousPost={post?.isAnonymous || false}
        onReply={handleReplyPress}
        onLike={handleLike}
        onUpdate={handleEdit}
        onDelete={handleDelete}
        onReport={handleReport}
        currentUserId={user?.id || ""}
        onEditStateChange={setIsAnyCommentEditing}
      />
    ),
    [
      postId,
      post?.isAnonymous,
      post?.user?._id,
      user?.id,
      handleLike,
      handleDelete,
      handleEdit,
      handleReport,
    ],
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No comments yet</Text>
        <Text style={styles.emptyText}>Be the first to comment!</Text>
      </View>
    );
  }, [loading]);

  const renderFooter = useCallback(() => {
    if (!loading || comments.length === 0) return null;
    return <ActivityIndicator style={styles.footerLoader} color="#8b5cf6" />;
  }, [loading, comments.length]);

  // ===== Loading State =====
  if (loading && !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    );
  }

  // ===== Main Render =====
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <CommentHeader
          totalComments={totalComments}
          onBackPress={() => router.back()}
        />

        <FlatList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item._id}
          renderItem={renderCommentItem}
          ListHeaderComponent={renderPostHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onRefresh={onRefresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="always"
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          onScrollToIndexFailed={(info) => {
            const wait = new Promise((resolve) => setTimeout(resolve, 500));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                viewPosition: 0.5,
                animated: true,
              });
            });
          }}
          extraData={comments}
        />

        {/* Hide main input when any comment is being edited */}
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

        <ImageModal
          visible={imageModalVisible}
          onClose={() => setImageModalVisible(false)}
          images={
            post?.images?.map((img) => ({ url: getFullImageUrl(img.url) })) ||
            []
          }
          selectedIndex={selectedImageIndex}
          onScroll={handleModalScroll}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",

    color: "#6b7280",
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
