// app/components/Feed/Comment/useComments.ts

import { useState, useCallback, useRef } from "react";
import { Alert, Share } from "react-native";
import {
  addComment,
  addReply,
  toggleCommentLike,
  updateComment,
  deleteComment,
  Comment,
} from "@/lib/services/postService";
import { commentEvents, EVENTS } from "@/lib/utils/eventEmitter";
import { reportContent } from "@/lib/services/contentService";

// ===== Helper Functions =====
const hasPopulatedReplies = (comment: Comment): boolean => {
  return (
    Array.isArray(comment.replies) &&
    comment.replies.length > 0 &&
    typeof comment.replies[0] !== "string"
  );
};

const getPopulatedReplies = (comment: Comment): Comment[] => {
  if (Array.isArray(comment.replies) && comment.replies.length > 0) {
    const firstReply = comment.replies[0];
    if (typeof firstReply !== "string") {
      return comment.replies as Comment[];
    }
  }
  return [];
};

const countAllComments = (comments: Comment[]): number => {
  let count = 0;
  for (const comment of comments) {
    count++;
    if (hasPopulatedReplies(comment)) {
      count += countAllComments(getPopulatedReplies(comment));
    }
  }
  return count;
};

const addReplyToTree = (
  comments: Comment[],
  parentId: string,
  newReply: Comment,
): Comment[] => {
  return comments.map((comment) => {
    if (comment._id === parentId) {
      const currentReplies = hasPopulatedReplies(comment)
        ? [...getPopulatedReplies(comment)]
        : [];
      return {
        ...comment,
        replies: [...currentReplies, newReply],
      };
    }
    if (hasPopulatedReplies(comment)) {
      return {
        ...comment,
        replies: addReplyToTree(
          getPopulatedReplies(comment),
          parentId,
          newReply,
        ),
      };
    }
    return comment;
  });
};

const deleteFromTree = (comments: Comment[], commentId: string): Comment[] => {
  return comments
    .filter((comment) => comment._id !== commentId)
    .map((comment) => {
      if (hasPopulatedReplies(comment)) {
        return {
          ...comment,
          replies: deleteFromTree(getPopulatedReplies(comment), commentId),
        };
      }
      return comment;
    });
};

const updateInTree = (
  comments: Comment[],
  commentId: string,
  content: string,
): Comment[] => {
  return comments.map((comment) => {
    if (comment._id === commentId) {
      return { ...comment, content, isEdited: true };
    }
    if (hasPopulatedReplies(comment)) {
      return {
        ...comment,
        replies: updateInTree(getPopulatedReplies(comment), commentId, content),
      };
    }
    return comment;
  });
};

const toggleLikeInTree = (
  comments: Comment[],
  commentId: string,
  userId: string,
): Comment[] => {
  if (!userId) return comments;

  return comments.map((comment) => {
    if (comment._id === commentId) {
      const likesArray = (comment.likes || []).filter((id: any) => id != null);

      const userLiked = likesArray.some((id: any) => {
        if (!id) return false;
        if (typeof id === "object" && id !== null && id._id) {
          return id._id.toString() === userId;
        }
        if (typeof id === "string") {
          return id === userId;
        }
        if (id.toString && typeof id.toString === "function") {
          return id.toString() === userId;
        }
        return false;
      });

      const newLikes = userLiked
        ? likesArray.filter((id: any) => {
            if (!id) return false;
            let idStr = "";
            if (typeof id === "object" && id !== null && id._id) {
              idStr = id._id.toString();
            } else if (typeof id === "string") {
              idStr = id;
            } else if (id.toString && typeof id.toString === "function") {
              idStr = id.toString();
            }
            return idStr !== userId;
          })
        : [...likesArray, userId];

      return {
        ...comment,
        likes: newLikes,
        isLiked: !userLiked,
      };
    }
    if (hasPopulatedReplies(comment)) {
      return {
        ...comment,
        replies: toggleLikeInTree(
          getPopulatedReplies(comment),
          commentId,
          userId,
        ),
      };
    }
    return comment;
  });
};

/**
 * Mark a comment as reported in the tree (after successful report API call)
 */
const markReportedInTree = (
  comments: Comment[],
  commentId: string,
): Comment[] => {
  return comments.map((comment) => {
    if (comment._id === commentId) {
      return { ...comment, isReported: true };
    }
    if (hasPopulatedReplies(comment)) {
      return {
        ...comment,
        replies: markReportedInTree(getPopulatedReplies(comment), commentId),
      };
    }
    return comment;
  });
};

export const useComments = (
  postId: string,
  comments: Comment[],
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
  setTotalComments: React.Dispatch<React.SetStateAction<number>>,
  setPost?: React.Dispatch<React.SetStateAction<any>>,
  user?: any,
) => {
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
    mentionUsername: string;
    isAnonymous: boolean;
  } | null>(null);

  // Helper to update count and emit event
  const updateCountAndEmit = useCallback(
    (newComments: Comment[]) => {
      const count = countAllComments(newComments);
      setComments(newComments);
      setTotalComments(count);

      // Emit event for PostCard
      commentEvents.emit(EVENTS.COMMENT_COUNT_CHANGED, {
        postId,
        count,
      });

      // Update post if available
      if (setPost) {
        setPost((prev: any) => {
          if (!prev) return prev;
          return { ...prev, commentCount: count };
        });
      }
    },
    [postId, setComments, setTotalComments, setPost],
  );

  const handleSubmit = async (
    commentText: string,
    isAnonymous: boolean,
    onSuccess: () => void,
  ) => {
    const trimmedText = commentText.trim();
    if (!trimmedText) return;
    if (!user) {
      Alert.alert("Error", "You must be logged in to comment");
      return;
    }

    setSubmitting(true);
    try {
      if (replyingTo) {
        const response = await addReply(
          postId,
          replyingTo.commentId,
          trimmedText,
          isAnonymous,
        );

        setComments((prev) => {
          const updated = addReplyToTree(
            prev,
            replyingTo.commentId,
            response.reply,
          );
          const count = countAllComments(updated);
          setTotalComments(count);

          commentEvents.emit(EVENTS.COMMENT_COUNT_CHANGED, { postId, count });

          if (setPost) {
            setPost((prevPost: any) => ({
              ...prevPost,
              commentCount: count,
            }));
          }

          return updated;
        });
      } else {
        const response = await addComment(postId, trimmedText, isAnonymous);

        setComments((prev) => {
          const updated = [response.comment, ...prev];
          const count = countAllComments(updated);
          setTotalComments(count);

          commentEvents.emit(EVENTS.COMMENT_COUNT_CHANGED, { postId, count });

          if (setPost) {
            setPost((prevPost: any) => ({
              ...prevPost,
              commentCount: count,
            }));
          }

          return updated;
        });
      }

      onSuccess();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to like comments");
      return;
    }

    const userId = user.id;
    if (!userId) return;

    // Optimistic update
    setComments((prev) => toggleLikeInTree(prev, commentId, userId));

    try {
      await toggleCommentLike(postId, commentId);
    } catch (error: any) {
      // Revert on error
      setComments((prev) => toggleLikeInTree(prev, commentId, userId));
      Alert.alert("Error", error.message || "Failed to like comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(postId, commentId);

      setComments((prev) => {
        const updated = deleteFromTree(prev, commentId);
        updateCountAndEmit(updated);
        return updated;
      });
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", error.message || "Failed to delete comment");
    }
  };

  const handleEdit = async (commentId: string, newContent: string) => {
    try {
      await updateComment(postId, commentId, newContent);
      setComments((prev) => updateInTree(prev, commentId, newContent));
      Alert.alert("Success", "Comment updated");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update comment");
      throw error;
    }
  };

  /**
   * handleReport: Called AFTER ReportModal successfully submits a report
   * This only updates local state to mark the comment as reported
   */
  const handleReport = useCallback(
    (commentId: string) => {
      setComments((prev) => markReportedInTree(prev, commentId));
    },
    [setComments],
  );

  const handleShare = async (commentId: string) => {
    try {
      const findComment = (commentsList: Comment[]): Comment | null => {
        for (const comment of commentsList) {
          if (comment._id === commentId) return comment;
          if (hasPopulatedReplies(comment)) {
            const found = findComment(getPopulatedReplies(comment));
            if (found) return found;
          }
        }
        return null;
      };

      const commentToShare = findComment(comments);
      if (!commentToShare) {
        Alert.alert("Error", "Comment not found");
        return;
      }

      await Share.share({
        message: `"${commentToShare.content}"`,
        title: "Share Comment",
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to share comment");
    }
  };

  const handleHide = (commentId: string) => {
    Alert.alert("Hide Comment", "Are you sure you want to hide this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        style: "destructive",
        onPress: () => {
          setComments((prev) => {
            const updated = deleteFromTree(prev, commentId);
            updateCountAndEmit(updated);
            return updated;
          });
        },
      },
    ]);
  };

  return {
    submitting,
    replyingTo,
    setReplyingTo,
    handleSubmit,
    handleLike,
    handleDelete,
    handleReport, 
    handleEdit,
    handleShare,
    handleHide,
  };
};

export default useComments;
