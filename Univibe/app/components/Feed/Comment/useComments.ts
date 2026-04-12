import { useState, useCallback } from "react";
import { Alert, Share } from "react-native";
import {
  addComment,
  addReply,
  toggleCommentLike,
  updateComment,
  deleteComment,
  Comment,
} from "@/lib/services/postService";

export const useComments = (
  postId: string,
  comments: Comment[],
  setComments: React.Dispatch<React.SetStateAction<Comment[]>>,
  setTotalComments: React.Dispatch<React.SetStateAction<number>>,
  setPost?: React.Dispatch<React.SetStateAction<any>>,
  user?: any
) => {
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    username: string;
    mentionUsername: string;
    isAnonymous: boolean;
  } | null>(null);
  const [hiddenComments, setHiddenComments] = useState<Set<string>>(new Set());

  /**
   * Helper Functions for Reply Management
   */
  const getPopulatedReplies = (comment: Comment): Comment[] => {
    if (Array.isArray(comment.replies) && comment.replies.length > 0) {
      const firstReply = comment.replies[0];
      if (typeof firstReply !== "string") {
        return comment.replies as Comment[];
      }
    }
    return [];
  };

  const hasPopulatedReplies = (comment: Comment): boolean => {
    return (
      Array.isArray(comment.replies) &&
      comment.replies.length > 0 &&
      typeof comment.replies[0] !== "string"
    );
  };

  /**
   * Count total comments in a tree (including the comment itself and all its replies)
   */
  const countTotalComments = (comment: Comment): number => {
    let count = 1; // Count the comment itself
    
    if (hasPopulatedReplies(comment)) {
      const replies = getPopulatedReplies(comment);
      replies.forEach(reply => {
        count += countTotalComments(reply);
      });
    }
    
    return count;
  };

  /**
   * Count total comments to be deleted from a list
   */
  const countCommentsToDelete = (commentsList: Comment[], targetId: string): number => {
    for (const comment of commentsList) {
      if (comment._id === targetId) {
        return countTotalComments(comment);
      }
      
      if (hasPopulatedReplies(comment)) {
        const replies = getPopulatedReplies(comment);
        const count = countCommentsToDelete(replies, targetId);
        if (count > 0) {
          return count;
        }
      }
    }
    return 0;
  };

  /**
   * Add a reply to a comment in the tree
   */
  const addReplyToComment = useCallback((
    commentsList: Comment[],
    targetId: string,
    newReply: Comment,
  ): Comment[] => {
    return commentsList.map((comment) => {
      if (comment._id === targetId) {
        const currentReplies: Comment[] = hasPopulatedReplies(comment)
          ? getPopulatedReplies(comment)
          : [];

        return {
          ...comment,
          replies: [...currentReplies, newReply],
        };
      }

      if (hasPopulatedReplies(comment)) {
        const populatedReplies = getPopulatedReplies(comment);
        const updatedReplies = addReplyToComment(
          populatedReplies,
          targetId,
          newReply,
        );
        return {
          ...comment,
          replies: updatedReplies,
        };
      }

      return comment;
    });
  }, []);

  /**
   * Submit a new comment or reply
   */
  const handleSubmit = async (
    commentText: string,
    isAnonymous: boolean,
    onSuccess: () => void
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
        // Handle reply - trimmedText already contains @mentionUsername from input
        const response = await addReply(
          postId,
          replyingTo.commentId,
          trimmedText,
          isAnonymous,
        );

        setComments((prev) => addReplyToComment(prev, replyingTo.commentId, response.reply));
        setTotalComments((prev) => prev + 1);

        if (setPost) {
          setPost((prev: any) => ({
            ...prev,
            commentCount: (prev.commentCount || 0) + 1,
          }));
        }
      } else {
        // Handle new comment
        const response = await addComment(postId, trimmedText, isAnonymous);
        setComments((prev) => [response.comment, ...prev]);
        setTotalComments((prev) => prev + 1);

        if (setPost) {
          setPost((prev: any) => ({
            ...prev,
            commentCount: (prev.commentCount || 0) + 1,
          }));
        }
      }

      onSuccess();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle liking/unliking a comment
   */
  const handleLike = async (commentId: string) => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to like comments");
      return;
    }

    const updateLikeInComments = (commentsList: Comment[]): Comment[] => {
      return commentsList.map((comment) => {
        if (comment._id === commentId) {
          const userLiked = comment.likes?.some((id: any) => id.toString() === user?._id?.toString());
          return {
            ...comment,
            likes: userLiked
              ? comment.likes?.filter((id: any) => id.toString() !== user?._id?.toString()) || []
              : [...(comment.likes || []), user?._id],
            isLiked: !userLiked,
          };
        }

        if (hasPopulatedReplies(comment)) {
          const populatedReplies = getPopulatedReplies(comment);
          const updatedReplies = updateLikeInComments(populatedReplies);
          return {
            ...comment,
            replies: updatedReplies,
          };
        }

        return comment;
      });
    };

    // Optimistic update
    setComments((prev) => updateLikeInComments(prev));

    try {
      await toggleCommentLike(postId, commentId);
    } catch (error: any) {
      // Revert on error
      setComments((prev) => updateLikeInComments(prev));
      Alert.alert("Error", error.message || "Failed to like comment");
    }
  };

  /**
   * Handle deleting a comment with proper count update
   */
  const handleDelete = async (commentId: string) => {
    try {
      // Count comments to be deleted BEFORE API call
      const commentsToDelete = countCommentsToDelete(comments, commentId);
      console.log(`📊 Deleting comment ${commentId} - Total comments to delete: ${commentsToDelete}`);

      // Call API to delete comment
      await deleteComment(postId, commentId);

      // Remove comment from tree
      const deleteCommentFromTree = (
        commentsList: Comment[],
      ): Comment[] => {
        return commentsList
          .filter((comment) => comment._id !== commentId)
          .map((comment) => {
            if (hasPopulatedReplies(comment)) {
              const populatedReplies = getPopulatedReplies(comment);
              const filteredReplies = deleteCommentFromTree(populatedReplies);
              return {
                ...comment,
                replies: filteredReplies,
              };
            }
            return comment;
          });
      };

      const newComments = deleteCommentFromTree(comments);
      
      // Update comments state
      setComments(newComments);
      
      // Update total comments count
      setTotalComments((prev) => {
        const newTotal = Math.max(0, prev - commentsToDelete);
        console.log(`📊 Comments count update - Old: ${prev}, Deleted: ${commentsToDelete}, New: ${newTotal}`);
        return newTotal;
      });

      // Update post comment count
      if (setPost) {
        setPost((prev: any) => {
          const oldCount = prev?.commentCount || 0;
          const newCount = Math.max(0, oldCount - commentsToDelete);
          return {
            ...prev,
            commentCount: newCount,
          };
        });
      }
      
      
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      Alert.alert("Error", error.message || "Failed to delete comment");
    }
  };

  /**
   * Handle sharing a comment
   */
  const handleShare = async (commentId: string) => {
    try {
      // Find the comment to share
      const findComment = (commentsList: Comment[]): Comment | null => {
        for (const comment of commentsList) {
          if (comment._id === commentId) {
            return comment;
          }
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

      const shareContent = {
        message: `"${commentToShare.content}"`,
        title: "Share Comment",
      };

      await Share.share(shareContent);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to share comment");
    }
  };

  /**
   * Handle hiding a comment
   */
  const handleHide = (commentId: string) => {
    Alert.alert(
      "Hide Comment",
      "Are you sure you want to hide this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide",
          style: "destructive",
          onPress: () => {
            // Count comments to hide
            const commentsToHide = countCommentsToDelete(comments, commentId);
            
            // Add to hidden comments set
            setHiddenComments((prev) => {
              const newSet = new Set(prev);
              newSet.add(commentId);
              return newSet;
            });

            // Filter out hidden comments
            const filterHiddenComments = (commentsList: Comment[]): Comment[] => {
              return commentsList
                .filter((comment) => !hiddenComments.has(comment._id) && comment._id !== commentId)
                .map((comment) => {
                  if (hasPopulatedReplies(comment)) {
                    return {
                      ...comment,
                      replies: filterHiddenComments(getPopulatedReplies(comment)),
                    };
                  }
                  return comment;
                });
            };

            setComments((prev) => filterHiddenComments(prev));
            
            // Update total count
            setTotalComments((prev) => Math.max(0, prev - commentsToHide));

            Alert.alert("Success", `Comment and ${commentsToHide - 1} repl${commentsToHide - 1 === 1 ? 'y' : 'ies'} hidden`);
          },
        },
      ]
    );
  };

  /**
   * Handle reporting a comment
   */
  const handleReport = (commentId: string) => {
    Alert.alert(
      "Report Submitted",
      "Thank you for reporting this comment. Our team will review it."
    );
    console.log("Reported comment:", commentId);
  };

  /**
   * Handle editing a comment
   */
  const handleEdit = async (commentId: string, newContent: string) => {
    try {
      await updateComment(postId, commentId, newContent);
      
      // Update the comment in local state
      const updateCommentInTree = (commentsList: Comment[]): Comment[] => {
        return commentsList.map((comment) => {
          if (comment._id === commentId) {
            return {
              ...comment,
              content: newContent,
              isEdited: true,
            };
          }

          if (hasPopulatedReplies(comment)) {
            const populatedReplies = getPopulatedReplies(comment);
            const updatedReplies = updateCommentInTree(populatedReplies);
            return {
              ...comment,
              replies: updatedReplies,
            };
          }

          return comment;
        });
      };

      setComments((prev) => updateCommentInTree(prev));
      Alert.alert("Success", "Comment updated");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update comment");
      throw error;
    }
  };

  return {
    // State
    submitting,
    replyingTo,
    setReplyingTo,
    hiddenComments,
    
    // Actions
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