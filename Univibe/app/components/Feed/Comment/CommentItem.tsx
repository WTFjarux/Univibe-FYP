// app/components/Feed/Comment/CommentItem.tsx

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  ImageSourcePropType,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Comment, areRepliesPopulated } from "@/lib/services/postService";
import {
  formatCommentUserDisplay,
  getCommentDepthColor,
  isCommentFromPostAuthor,
  formatCommentTimestamp,
} from "@/lib/services/postService";
import CommentOptionsModal from "./CommentOptionsModal";
import BlurhashImage from "@/app/components/BlurhashImage";
import { API_BASE_URL } from "@/constants/ipConstants";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";

// Local default avatar
const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");

interface CommentItemProps {
  comment: Comment;
  postId: string;
  postAuthorId: string;
  isAnonymousPost: boolean;
  depth?: number;
  onReply: (
    commentId: string,
    displayName: string,
    username: string,
    isAnonymous: boolean,
  ) => void;
  onLike: (commentId: string) => Promise<void>;
  onUpdate?: (commentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
  onReport?: (commentId: string) => void;
  onHide?: (commentId: string) => void;
  onShare?: (commentId: string) => void;
  currentUserId: string;
  level?: number;
  onEditStateChange?: (isEditing: boolean) => void;
  onOptionsOpen?: () => void;
  onOptionsClose?: () => void;
  onShowInfoBar?: (message: string, type: "success" | "error" | "info") => void;
}

/**
 * Helper function to get profile image with local default fallback
 */
const getProfileImageSource = (
  imageUrl: string | undefined,
): ImageSourcePropType => {
  if (imageUrl && imageUrl.trim() !== "") {
    let url = imageUrl;
    if (url.startsWith("/")) {
      url = `${API_BASE_URL}${url}`;
    }
    return { uri: url };
  }
  return DEFAULT_AVATAR;
};

/**
 * Helper to extract mention from text - captures full display name with spaces
 */
const extractMention = (
  content: string,
): { mention: string; remaining: string } => {
  if (!content.startsWith("@")) {
    return { mention: "", remaining: content };
  }

  const withoutAt = content.substring(1);
  let mentionEnd = content.length;

  for (let i = 1; i < content.length; i++) {
    if (
      content[i] === " " &&
      i + 1 < content.length &&
      content[i + 1] !== "@"
    ) {
      mentionEnd = i;
      break;
    }
  }

  const mention = content.substring(0, mentionEnd).trim();
  const remaining = content.substring(mentionEnd).trimStart();

  return { mention, remaining };
};

/**
 * Recursive component that renders a single comment and all its nested replies
 */
const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  postId,
  postAuthorId,
  isAnonymousPost,
  depth = comment?.depth ?? 1,
  onReply,
  onLike,
  onUpdate,
  onDelete,
  onReport,
  onHide,
  onShare,
  currentUserId,
  level = 0,
  onEditStateChange,
  onOptionsOpen,
  onOptionsClose,
  onShowInfoBar,
}) => {
  // ===== Hooks =====
  const router = useRouter();
  const { user: currentUserData } = useAuth();
  const { colors, isDark } = useTheme();

  // ===== State =====
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [longPressed, setLongPressed] = useState(false);

  // ===== Animation =====
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ===== Effects =====
  useEffect(() => {
    if (onEditStateChange) {
      onEditStateChange(isEditing);
    }
  }, [isEditing, onEditStateChange]);

  // ===== Memoized Values =====
  const displayInfo = useMemo(
    () => formatCommentUserDisplay(comment, isAnonymousPost),
    [comment, isAnonymousPost],
  );

  const isAnonymous = useMemo(
    () => comment.isAnonymous || comment.isFromAnonymousPost,
    [comment.isAnonymous, comment.isFromAnonymousPost],
  );

  const isFromAuthor = useMemo(
    () => isCommentFromPostAuthor(comment, postAuthorId) && !isAnonymous,
    [comment, postAuthorId, isAnonymous],
  );

  const depthColor = useMemo(() => getCommentDepthColor(depth), [depth]);
  const formattedTime = useMemo(
    () => formatCommentTimestamp(comment.createdAt),
    [comment.createdAt],
  );

  // ===== Ownership Checks =====
  const currentUserIdStr = currentUserId?.toString() || "";
  const commentUserIdStr = comment.user?._id?.toString() || "";
  const postAuthorIdStr = postAuthorId?.toString() || "";

  const isOwnComment = currentUserIdStr === commentUserIdStr;
  const isPostOwner = currentUserIdStr === postAuthorIdStr;

  // ===== Replies Handling =====
  const hasReplies =
    Array.isArray(comment.replies) && comment.replies.length > 0;
  const repliesArePopulated =
    hasReplies && areRepliesPopulated(comment.replies);
  const replyCount = hasReplies ? comment.replies.length : 0;

  // ===== Constants =====
  const MAX_DEPTH = 5;
  const INDENTATION = level * 16;

  // ===== Mention Detection =====
  const mentionData = useMemo(
    () => extractMention(comment.content),
    [comment.content],
  );
  const hasMention = mentionData.mention !== "" && level > 0;
  const mentionText = mentionData.mention;
  const remainingText = mentionData.remaining;

  // ===== Dynamic Styles =====
  const dynamicStyles = useMemo(
    () => ({
      longPressed: {
        backgroundColor: isDark ? colors.border : "#f3f4f6",
      },
      avatar: {
        backgroundColor: isDark ? colors.border : "#f3f4f6",
      },
      anonymousAvatar: {
        backgroundColor: isDark ? colors.background : "#f3f4f6",
        borderColor: colors.border,
      },
      userName: {
        color: colors.text,
      },
      anonymousName: {
        color: colors.textSecondary,
      },
      authorBadge: {
        backgroundColor: isDark ? colors.primaryLight : "#fef3c7",
      },
      authorBadgeText: {
        color: isDark ? colors.primary : "#92400e",
      },
      anonymousBadge: {
        backgroundColor: isDark ? colors.border : "#f3f4f6",
      },
      anonymousBadgeText: {
        color: colors.textSecondary,
      },
      editedBadge: {
        color: colors.textMuted,
      },
      mentionText: {
        color: colors.primary,
      },
      commentText: {
        color: isDark ? colors.textSecondary : "#374151",
      },
      timestamp: {
        color: colors.textMuted,
      },
      footerActionText: {
        color: colors.textSecondary,
      },
      editInput: {
        borderColor: colors.primary,
        backgroundColor: colors.card,
        color: colors.text,
      },
      cancelButtonText: {
        color: colors.textSecondary,
      },
      saveButton: {
        backgroundColor: colors.primary,
      },
      toggleRepliesText: {
        color: colors.textSecondary,
      },
    }),
    [colors, isDark],
  );

  // ===== Navigation Handler =====
  const handleUserPress = useCallback(() => {
    if (isAnonymous) return;

    const userId = comment.user?._id?.toString();
    if (!userId) return;

    if (userId === currentUserData?.id?.toString()) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/profile/${userId}`);
    }
  }, [isAnonymous, comment.user?._id, currentUserData?.id, router]);

  // ===== Handlers =====
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 3,
    }).start();
  };

  const handleLongPress = () => {
    setLongPressed(true);
    handlePressOut();
    setOptionsVisible(true);
    if (onOptionsOpen) {
      onOptionsOpen();
    }
    setTimeout(() => setLongPressed(false), 200);
  };

  const handleOptionsClose = useCallback(() => {
    setOptionsVisible(false);
    if (onOptionsClose) {
      onOptionsClose();
    }
  }, [onOptionsClose]);

  const handleReplyPress = useCallback(() => {
    const usernameForBackend =
      comment.user?.username ||
      displayInfo.name.toLowerCase().replace(/\s/g, "");
    onReply(comment._id, displayInfo.name, usernameForBackend, false);
  }, [comment._id, displayInfo.name, comment.user?.username, onReply]);

  const handleLike = useCallback(async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      await onLike(comment._id);
    } catch {
      Alert.alert("Error", "Failed to like comment");
    } finally {
      setIsLiking(false);
    }
  }, [comment._id, isLiking, onLike]);

  const handleUpdate = useCallback(async () => {
    if (!editText.trim() || !onUpdate) return;
    setIsSubmitting(true);
    try {
      await onUpdate(comment._id, editText.trim());
      setIsEditing(false);
    } catch {
      Alert.alert("Error", "Failed to update comment");
    } finally {
      setIsSubmitting(false);
    }
  }, [editText, comment._id, onUpdate]);

  const handleDelete = useCallback(async () => {
    try {
      if (onDelete) {
        await onDelete(comment._id);
      }
    } catch {
      Alert.alert("Error", "Failed to delete comment");
    }
  }, [comment._id, onDelete]);

  const handleReport = useCallback(() => {
    if (onReport) onReport(comment._id);
  }, [comment._id, onReport]);

  const handleHide = useCallback(() => {
    if (onHide) onHide(comment._id);
  }, [comment._id, onHide]);

  const handleShare = useCallback(() => {
    if (onShare) onShare(comment._id);
  }, [comment._id, onShare]);

  const handleModalReply = useCallback(() => {
    const usernameForBackend =
      comment.user?.username ||
      displayInfo.name.toLowerCase().replace(/\s/g, "");
    onReply(comment._id, displayInfo.name, usernameForBackend, false);
  }, [comment._id, displayInfo.name, comment.user?.username, onReply]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText(comment.content);
  }, [comment.content]);

  const handleStartEdit = () => {
    Keyboard.dismiss();
    setTimeout(() => setIsEditing(true), 100);
  };

  // ===== Render Helpers =====
  const renderAvatar = () => {
    if (isAnonymous) {
      return (
        <View
          style={[
            styles.avatar,
            styles.anonymousAvatar,
            dynamicStyles.anonymousAvatar,
          ]}
        >
          <Ionicons name="eye-off-outline" size={18} color={colors.textMuted} />
        </View>
      );
    }

    if (avatarError) {
      return (
        <TouchableOpacity onPress={handleUserPress}>
          <View
            style={[
              styles.avatar,
              styles.fallbackAvatar,
              { backgroundColor: colors.primary },
            ]}
          >
            <Text style={styles.fallbackAvatarText}>
              {displayInfo.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    const profileImageUrl = comment.user?.profilePicture;

    if (!profileImageUrl) {
      return (
        <TouchableOpacity onPress={handleUserPress}>
          <Image
            source={DEFAULT_AVATAR}
            style={[styles.avatar, dynamicStyles.avatar]}
            contentFit="cover"
          />
        </TouchableOpacity>
      );
    }

    const fullUrl = profileImageUrl.startsWith("http")
      ? profileImageUrl
      : `${API_BASE_URL}${profileImageUrl}`;

    return (
      <TouchableOpacity onPress={handleUserPress}>
        <BlurhashImage
          uri={fullUrl}
          style={styles.avatar}
          transition={200}
          onError={() => setAvatarError(true)}
        />
      </TouchableOpacity>
    );
  };

  const renderBadges = () => (
    <View style={styles.badgeContainer}>
      {isFromAuthor && (
        <View style={[styles.authorBadge, dynamicStyles.authorBadge]}>
          <Ionicons name="star" size={12} color="#fbbf24" />
          <Text style={[styles.authorBadgeText, dynamicStyles.authorBadgeText]}>
            Author
          </Text>
        </View>
      )}
      {isAnonymous && (
        <View style={[styles.anonymousBadge, dynamicStyles.anonymousBadge]}>
          <Ionicons
            name="eye-off-outline"
            size={10}
            color={colors.textSecondary}
          />
          <Text
            style={[
              styles.anonymousBadgeText,
              dynamicStyles.anonymousBadgeText,
            ]}
          >
            Anonymous
          </Text>
        </View>
      )}
      {comment.isEdited && (
        <Text style={[styles.editedBadge, dynamicStyles.editedBadge]}>
          (edited)
        </Text>
      )}
    </View>
  );

  const renderActions = () => (
    <View style={styles.footer}>
      <Text style={[styles.timestamp, dynamicStyles.timestamp]}>
        {formattedTime}
      </Text>

      <TouchableOpacity
        style={styles.footerAction}
        onPress={handleLike}
        disabled={isLiking}
      >
        <Ionicons
          name={comment.isLiked ? "heart" : "heart-outline"}
          size={16}
          color={comment.isLiked ? "#ef4444" : colors.textSecondary}
        />
        <Text
          style={[
            styles.footerActionText,
            dynamicStyles.footerActionText,
            comment.isLiked && styles.likedText,
          ]}
        >
          {comment.likes?.length || 0}
        </Text>
      </TouchableOpacity>

      {depth < MAX_DEPTH && (
        <TouchableOpacity
          style={styles.footerAction}
          onPress={handleReplyPress}
        >
          <Ionicons
            name="chatbubble-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.footerActionText, dynamicStyles.footerActionText]}
          >
            Reply
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEditMode = () => (
    <View style={styles.editContainer}>
      <TextInput
        style={[styles.editInput, dynamicStyles.editInput]}
        value={editText}
        onChangeText={setEditText}
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus
        maxLength={500}
      />
      <View style={styles.editActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelEdit}
        >
          <Text
            style={[styles.cancelButtonText, dynamicStyles.cancelButtonText]}
          >
            Cancel
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            dynamicStyles.saveButton,
            (!editText.trim() || isSubmitting) && styles.disabledButton,
          ]}
          onPress={handleUpdate}
          disabled={!editText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.badgeText} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCommentContent = () => {
    if (isEditing) return renderEditMode();

    if (hasMention && mentionText) {
      return (
        <View style={styles.commentContentWrapper}>
          <Text style={[styles.mentionText, dynamicStyles.mentionText]}>
            {mentionText}
          </Text>
          {remainingText ? (
            <Text style={[styles.commentText, dynamicStyles.commentText]}>
              {remainingText}
            </Text>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.commentContentWrapper}>
        <Text style={[styles.commentText, dynamicStyles.commentText]}>
          {comment.content}
        </Text>
      </View>
    );
  };

  const renderReplies = () => {
    if (!hasReplies) return null;

    if (!repliesArePopulated) {
      return (
        <TouchableOpacity
          style={styles.toggleRepliesButton}
          onPress={() => setShowReplies(!showReplies)}
        >
          <Ionicons
            name="chatbubble-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.toggleRepliesText, dynamicStyles.toggleRepliesText]}
          >
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.repliesSection}>
        <TouchableOpacity
          style={styles.toggleRepliesButton}
          onPress={() => setShowReplies(!showReplies)}
        >
          <Ionicons
            name={showReplies ? "chevron-down" : "chevron-forward"}
            size={16}
            color={colors.textSecondary}
          />
          <Text
            style={[styles.toggleRepliesText, dynamicStyles.toggleRepliesText]}
          >
            {showReplies ? "Hide" : "Show"} {replyCount}{" "}
            {replyCount === 1 ? "reply" : "replies"}
          </Text>
        </TouchableOpacity>

        {showReplies && (
          <View style={styles.repliesList}>
            {(comment.replies as Comment[]).map((reply) => (
              <CommentItem
                key={reply._id}
                comment={reply}
                postId={postId}
                postAuthorId={postAuthorId}
                isAnonymousPost={isAnonymousPost}
                depth={reply.depth}
                onReply={onReply}
                onLike={onLike}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onReport={onReport}
                onHide={onHide}
                onShare={onShare}
                currentUserId={currentUserId}
                level={level + 1}
                onEditStateChange={onEditStateChange}
                onOptionsOpen={onOptionsOpen}
                onOptionsClose={onOptionsClose}
                onShowInfoBar={onShowInfoBar}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // ===== Main Render =====
  return (
    <>
      <Animated.View
        style={[
          styles.container,
          { marginLeft: INDENTATION },
          { transform: [{ scale: scaleAnim }] },
          longPressed && dynamicStyles.longPressed,
        ]}
      >
        {level > 0 && (
          <View style={[styles.depthLine, { backgroundColor: depthColor }]} />
        )}

        <TouchableWithoutFeedback
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLongPress={handleLongPress}
          delayLongPress={500}
        >
          <View style={styles.commentContainer}>
            {renderAvatar()}

            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <View style={styles.userInfo}>
                  <TouchableOpacity
                    onPress={handleUserPress}
                    disabled={isAnonymous}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.userName,
                        dynamicStyles.userName,
                        isAnonymous && dynamicStyles.anonymousName,
                      ]}
                    >
                      {displayInfo.name}
                    </Text>
                  </TouchableOpacity>
                  {renderBadges()}
                </View>
              </View>

              {renderCommentContent()}
              {renderActions()}
            </View>
          </View>
        </TouchableWithoutFeedback>

        {renderReplies()}
      </Animated.View>

      <CommentOptionsModal
        visible={optionsVisible}
        onClose={handleOptionsClose}
        commentId={comment._id}
        postId={postId}
        isOwnComment={isOwnComment}
        isPostOwner={isPostOwner}
        isReported={comment.isReported || false}
        onReply={handleModalReply}
        onShare={handleShare}
        onEdit={handleStartEdit}
        onDelete={handleDelete}
        onHide={handleHide}
        onReport={handleReport}
        onShowInfoBar={onShowInfoBar}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    marginTop: 12,
    position: "relative",
  },
  depthLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.3,
    borderRadius: 1,
  },
  commentContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "transparent",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  fallbackAvatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  fallbackAvatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  authorBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  authorBadgeText: {
    fontSize: 10,
    fontFamily: "SofiaSans-Regular",
    fontWeight: "500",
  },
  anonymousBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 2,
  },
  anonymousBadgeText: {
    fontSize: 10,
  },
  editedBadge: {
    fontSize: 11,
    fontStyle: "italic",
    fontFamily: "SofiaSans-Regular",
  },
  commentContentWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 6,
  },
  mentionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "500",
    marginRight: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  timestamp: {
    fontSize: 11,
  },
  footerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerActionText: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
  likedText: {
    color: "#ef4444",
  },
  editContainer: {
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 13,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.5,
  },
  repliesSection: {
    marginTop: 4,
  },
  toggleRepliesButton: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 52,
    paddingVertical: 6,
    gap: 4,
  },
  toggleRepliesText: {
    fontSize: 12,
    fontWeight: "500",
  },
  repliesList: {
    marginTop: 4,
  },
});

export default React.memo(CommentItem);
