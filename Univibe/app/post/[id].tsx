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
  const { token, user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      const response = await getPostById(id);
      if (response.success) {
        setPost(response.post);
      }
    } catch (error) {
      console.error("Error loading post:", error);
      Alert.alert("Error", "Failed to load post");
    }
  };

  const loadComments = async (pageNum = 1, shouldAppend = false) => {
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
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      if (shouldAppend) {
        setIsLoadingMore(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!commentText.trim()) return;

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
    if (hasMore && !isLoadingMore && comments.length > 0) {
      loadComments(page + 1, true);
    }
  };

  useEffect(() => {
    if (token && id) {
      loadPost();
      loadComments(1, false);
    }
    setLoading(false);
  }, [id, token]);

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

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
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
                onRepostPress={() => {}}
                onSharePress={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onSave={() => {}}
                onReport={() => {}}
                onHide={() => {}}
                onCopyLink={() => {}}
                onMuteUser={() => {}}
                onBlockUser={() => {}}
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
