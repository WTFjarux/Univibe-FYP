// app/components/Feed/Comment/CommentScreen.tsx

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
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";

// Components
import CommentHeader from "./CommentHeader";
import PostPreview from "./PostPreview";
import CommentItem from "./CommentItem";
import CommentInput from "./CommentInput";
import ImageModal from "./ImageModal";
import ReportModal from "@/app/components/ReportModal";
import CommentScreenSkeleton from "./CommentScreenSkeleton";

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
import { reportContent } from "@/lib/services/contentService";

const { width: screenWidth } = Dimensions.get("window");

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

const countAllComments = (comments: Comment[]): number => {
  let count = 0;
  for (const comment of comments) {
    count++;
    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      const firstReply = comment.replies[0];
      if (typeof firstReply === "object") {
        count += countAllComments(comment.replies as Comment[]);
      } else {
        count += comment.replies.length;
      }
    }
  }
  return count;
};

export default function CommentScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const { user, token } = useAuth();
  const { colors, isDark } = useTheme();

  // Post & Comments State
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [isAnyCommentEditing, setIsAnyCommentEditing] = useState(false);
  const [isPostLiked, setIsPostLiked] = useState(false);
  const [postLikesCount, setPostLikesCount] = useState(0);

  // InfoBar State
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useRef(new Animated.Value(100)).current;
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Report Modal State
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetType, setReportTargetType] = useState<
    "Post" | "Comment" | "User" | "Event"
  >("Comment");

  // Options Modal Tracking
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const isFetchingRef = useRef(false);

  const {
    submitting,
    replyingTo,
    setReplyingTo,
    handleSubmit,
    handleLike,
    handleDelete,
    handleReport: handleReportFromHook,
    handleEdit,
    handleShare,
    handleHide,
  } = useComments(
    postId,
    comments,
    setComments,
    setTotalComments,
    setPost,
    user,
  );

  // Dynamic Style Matrix
  const dynamicStyles = useMemo(
    () => ({
      container: {
        backgroundColor: colors.background,
      },
      emptyTitle: {
        color: colors.text,
      },
      emptyText: {
        color: colors.textSecondary,
      },
    }),
    [colors],
  );

  // InfoBar Management
  const showInfoBar = useCallback(
    (
      message: string,
      type: "success" | "error" | "info" = "info",
      autoHide = true,
    ) => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);

      setInfoMessage(message);
      setInfoType(type);

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (autoHide) {
        infoTimeoutRef.current = setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: 100,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setInfoMessage(null);
            slideAnim.setValue(100);
          });
        }, 3000);
      }
    },
    [slideAnim],
  );

  const hideInfoBar = useCallback(() => {
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setInfoMessage(null);
      slideAnim.setValue(100);
    });
  }, [slideAnim]);

  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, []);

  // Report Flow Orchestration
  const handleCommentReportPress = useCallback(
    (commentId: string) => {
      if (!token) {
        showInfoBar("Please login to report comments", "info");
        return;
      }

      const findComment = (commentsList: Comment[]): Comment | null => {
        for (const comment of commentsList) {
          if (comment._id === commentId) return comment;
          if (
            Array.isArray(comment.replies) &&
            comment.replies.length > 0 &&
            typeof comment.replies[0] === "object"
          ) {
            const found = findComment(comment.replies as Comment[]);
            if (found) return found;
          }
        }
        return null;
      };

      const comment = findComment(comments);
      if (comment?.isReported) {
        showInfoBar("You have already reported this comment", "info");
        return;
      }

      setReportTargetId(commentId);
      setReportTargetType("Comment");

      setTimeout(() => {
        setReportModalVisible(true);
      }, 300);
    },
    [token, comments, showInfoBar],
  );

  const handleReportModalClose = useCallback(() => {
    setReportModalVisible(false);
  }, []);

  const handleReportSuccess = useCallback(() => {
    if (reportTargetType === "Comment" && reportTargetId) {
      handleReportFromHook(reportTargetId);
    }
  }, [reportTargetType, reportTargetId, handleReportFromHook]);

  const handleReportShowInfoBar = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      showInfoBar(message, type);
    },
    [showInfoBar],
  );

  const handleOptionsModalOpen = useCallback(() => {
    setIsOptionsModalOpen(true);
  }, []);

  const handleOptionsModalClose = useCallback(() => {
    setIsOptionsModalOpen(false);
  }, []);

  // Fetch Logic
  const fetchPostDetails = async () => {
    try {
      const response = await getPostById(postId);
      setPost(response.post);
      setIsPostLiked(response.post.isLiked || false);
      setPostLikesCount(response.post.likes?.length || 0);
    } catch (error) {
      console.error("Error fetching post:", error);
    }
  };

  const fetchComments = async (pageNum = 1, refresh = false) => {
    if (isFetchingRef.current && pageNum > 1) return;
    if (refresh || pageNum === 1) isFetchingRef.current = true;

    try {
      const response = await getPostComments(postId, pageNum, 20);
      const typedComments = assertComments(response.comments);
      const actualCount = countAllComments(typedComments);

      if (refresh || pageNum === 1) {
        setComments(typedComments);
        setTotalComments(actualCount);
      } else {
        setComments((prev) => [...prev, ...typedComments]);
      }

      setHasMore(response.pagination?.pages > pageNum);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      if (pageNum === 1) {
        showInfoBar(error.message || "Failed to load comments", "error");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      if (refresh || pageNum === 1) isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (postId && token) {
      setLoading(true);
      setComments([]);
      setTotalComments(0);

      fetchPostDetails().then(() => {
        fetchComments(1, true);
      });
    } else if (!token) {
      setLoading(false);
      Alert.alert("Login Required", "Please login to view comments", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [postId, token]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(1);
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
      const newLikedState = !isPostLiked;
      setIsPostLiked(newLikedState);
      setPostLikesCount((prev) => (newLikedState ? prev + 1 : prev - 1));

      const response = await toggleLike(postId);
      setIsPostLiked(response.isLiked);
      setPostLikesCount(response.likes);
    } catch (error: any) {
      setIsPostLiked(!isPostLiked);
      setPostLikesCount((prev) => (isPostLiked ? prev + 1 : prev - 1));
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
    setTimeout(() => inputRef.current?.focus(), 100);
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
        onReport={handleCommentReportPress}
        onHide={handleHide}
        onShare={handleShare}
        currentUserId={user?.id || ""}
        onEditStateChange={setIsAnyCommentEditing}
        onOptionsOpen={handleOptionsModalOpen}
        onOptionsClose={handleOptionsModalClose}
        onShowInfoBar={handleReportShowInfoBar}
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
      handleCommentReportPress,
      handleHide,
      handleShare,
      handleOptionsModalOpen,
      handleOptionsModalClose,
      handleReportShowInfoBar,
    ],
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="chatbubbles-outline"
          size={48}
          color={colors.textMuted}
        />
        <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>
          No comments yet
        </Text>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
          Be the first to comment!
        </Text>
      </View>
    );
  }, [loading, colors, dynamicStyles]);

  const renderFooter = useCallback(() => {
    if (!loading || comments.length === 0) return null;
    return (
      <ActivityIndicator style={styles.footerLoader} color={colors.primary} />
    );
  }, [loading, comments.length, colors.primary]);

  const renderInfoBar = () => {
    if (!infoMessage) return null;

    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : colors.primary;
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
        <Ionicons name={icon} size={20} color={colors.badgeText} />
        <Text style={[styles.infoBarText, { color: colors.badgeText }]}>
          {infoMessage}
        </Text>
        <TouchableOpacity onPress={hideInfoBar} style={styles.infoBarClose}>
          <Ionicons name="close" size={20} color={colors.badgeText} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading && !post) {
    return <CommentScreenSkeleton />;
  }

  return (
    // Replaced standard context view to ensure colors.card flows smoothly into the screen base bounds
    <SafeAreaView
      style={[styles.container, dynamicStyles.container]}
      edges={["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          extraData={totalComments}
        />

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

        <ReportModal
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
      </KeyboardAvoidingView>

      {renderInfoBar()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  // 💡 Trimmed down from 100 to 16 to remove unnecessary trailing dead space beneath the flush comment input field
  listContent: { flexGrow: 1, paddingBottom: 16 },
  emptyContainer: { paddingVertical: 48, alignItems: "center" },
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
  footerLoader: { paddingVertical: 20, alignItems: "center" },
  infoBar: {
    position: "absolute",
    bottom: 35,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
    minHeight: 35,
  },
  infoBarText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    fontWeight: "500",
  },
  infoBarClose: {
    padding: 4,
  },
});
