// app/components/chat/ChatMessage/ChatMessageOptionsModal.tsx

import React, { useMemo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import ReplyPreview from "./ReplyPreview";
import AudioManager from "../../../../lib/utils/AudioManager";
import PostCard from "../../Feed/Post/PostCard";
import { Post } from "../../../../lib/services/postService";

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Available reactions
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

// Layout dimensions
const REACTION_WIDTH = 340;
const REACTION_BAR_HEIGHT = 56;
const ACTION_HEIGHT = 48;
const ACTION_SEPARATOR_HEIGHT = 0.5;
const ACTIONS_WIDTH = 220;

// Positioning
const SIDE_MARGIN = 12;
const VERTICAL_OFFSET = 12;
const SAFE_TOP = 60;
const SAFE_BOTTOM = 30;

// Spacing
const GAP_BETWEEN_PREVIEW_AND_ACTIONS = 25; // Gap between message preview and action buttons
const TOTAL_HEIGHT_PADDING = 60; // Extra padding for total modal height
const POST_MESSAGE_EXTRA_OFFSET = 30; // Extra offset for shared post messages
const REPLY_PREVIEW_HEIGHT = 50; // Extra height when reply preview is shown

// Message bubble
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;

// Media preview
const IMAGE_PREVIEW_WIDTH = SCREEN_WIDTH * 0.55;
const IMAGE_PREVIEW_HEIGHT = IMAGE_PREVIEW_WIDTH * 1.25;
const SHARED_POST_PREVIEW_HEIGHT = 300;

// Placeholder
const PHOTO_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

// Audio waveform
const WAVEFORM_BARS = [10, 18, 14, 22, 10, 16, 12];

// =============================================================================
// Types
// =============================================================================

interface ReplyTo {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
}

interface Message {
  _id: string;
  message: string;
  type?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  duration?: number;
  createdAt?: string;
  replyTo?: ReplyTo;
  sharedPost?: {
    postId: string;
    postContent?: string;
    postImage?: string;
    postAuthorId?: string;
    postAuthorName?: string;
    postAuthorUsername?: string;
    postAuthorAvatar?: string;
    isAnonymous?: boolean;
    postCreatedAt?: string;
  };
}

interface ChatMessageOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete?: () => void;
  onReaction: (reaction: string, shouldRemove?: boolean) => void;
  isOwnMessage: boolean;
  position: { x: number; y: number };
  selectedReaction?: string | null;
  message: Message;
  getFullImageUrl?: (url: string) => string;
  formatTime?: (dateString: string) => string;
  currentUserId?: string;
  DEFAULT_AVATAR?: any;
}

// =============================================================================
// Message Type Helpers
// =============================================================================

/** Check if message has a valid reply */
const isValidReply = (reply?: ReplyTo): boolean =>
  !!(
    reply &&
    reply.messageId &&
    reply.senderName &&
    reply.senderName.trim() !== ""
  );

/** Check if message is an image type */
const isImageMessage = (message: Message): boolean =>
  message.type === "image" && !!message.mediaUrl;

/** Check if message is a video type */
const isVideoMessage = (message: Message): boolean =>
  message.type === "video" && !!message.mediaUrl;

/** Check if message is an audio type */
const isAudioMessage = (message: Message): boolean => message.type === "audio";

/** Check if message is a file type */
const isFileMessage = (message: Message): boolean => message.type === "file";

/** Check if message is a location type */
const isLocationMessage = (message: Message): boolean =>
  message.type === "location";

/** Check if message is a shared post type */
const isPostMessage = (message: Message): boolean =>
  message.type === "post" && !!message.sharedPost;

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * MediaPreview - Displays image/video preview in the options modal
 */
const MediaPreview = ({
  uri,
  showPlayButton,
}: {
  uri: string;
  showPlayButton?: boolean;
}) => {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.mediaPreviewBox}>
      {/* Loading indicator */}
      {loading && (
        <View style={styles.mediaLoadingOverlay}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}

      {/* Image preview */}
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.mediaPreviewImage}
          placeholder={{ blurhash: PHOTO_BLURHASH }}
          placeholderContentFit="cover"
          transition={400}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onLoadEnd={() => setLoading(false)}
        />
      ) : (
        <View style={[styles.mediaPreviewBox, styles.mediaPlaceholder]}>
          <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.4)" />
        </View>
      )}

      {/* Play button overlay for videos */}
      {showPlayButton && uri && (
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <Ionicons
              name="play"
              size={22}
              color="#fff"
              style={{ marginLeft: 2 }}
            />
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * AudioPreview - Displays audio player or loading state in the options modal
 */
const AudioPreview = ({
  message,
  isOwnMessage,
}: {
  message: Message;
  isOwnMessage: boolean;
}) => {
  // Show loading state if audio hasn't been sent yet
  if (!message.mediaUrl) {
    return (
      <View style={styles.audioLoadingContainer}>
        <View style={styles.audioLoadingIconWrap}>
          <ActivityIndicator
            size="small"
            color={isOwnMessage ? "#fff" : "#585858"}
          />
        </View>
        <View style={styles.waveformContainer}>
          {WAVEFORM_BARS.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: h,
                  opacity: 0.3,
                  backgroundColor: isOwnMessage
                    ? "rgba(255,255,255,0.5)"
                    : "#8B5CF6",
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.audioLabel, isOwnMessage && { color: "#fff" }]}>
          Sending...
        </Text>
      </View>
    );
  }

  // Show audio player for sent audio
  return (
    <View style={styles.audioMessageContainer}>
      <AudioPlayer
        audioUrl={message.mediaUrl}
        duration={message.duration || 0}
        isOwnMessage={isOwnMessage}
        messageId={message._id}
        onPlayed={() => {}}
      />
    </View>
  );
};

/**
 * FilePreview - Displays file attachment preview in the options modal
 */
const FilePreview = ({
  message,
  isOwnMessage,
}: {
  message: Message;
  isOwnMessage: boolean;
}) => {
  const fileColor = "#8B5CF6";

  return (
    <View
      style={[
        styles.filePreviewContainer,
        isOwnMessage
          ? { backgroundColor: "rgba(0,0,0,0.15)" }
          : { backgroundColor: "rgba(0,0,0,0.05)" },
      ]}
    >
      <View style={[styles.fileIcon, { backgroundColor: `${fileColor}20` }]}>
        <Ionicons name="document-outline" size={24} color={fileColor} />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileName, isOwnMessage && { color: "#fff" }]}
          numberOfLines={2}
        >
          {message.message || "Document"}
        </Text>
      </View>
    </View>
  );
};

/**
 * LocationPreview - Displays location preview in the options modal
 */
const LocationPreview = ({ isOwnMessage }: { isOwnMessage: boolean }) => (
  <View
    style={[
      styles.locationPreviewContainer,
      isOwnMessage
        ? { backgroundColor: "rgba(0,0,0,0.15)" }
        : { backgroundColor: "rgba(0,0,0,0.05)" },
    ]}
  >
    <Ionicons
      name="location-sharp"
      size={22}
      color={isOwnMessage ? "rgba(255,255,255,0.9)" : "#FF3B30"}
    />
    <Text style={[styles.locationTitle, isOwnMessage && { color: "#fff" }]}>
      Location
    </Text>
  </View>
);

/**
 * SharedPostPreview - Displays shared post with optional caption in the options modal
 */
const SharedPostPreview = ({
  message,
  isOwnMessage,
}: {
  message: Message;
  isOwnMessage: boolean;
}) => {
  const sharedPost = message.sharedPost;
  if (!sharedPost?.postId) return null;

  // Build Post object from shared post data
  const postData: Post = {
    _id: sharedPost.postId,
    user: {
      _id: sharedPost.postAuthorId || "",
      name: sharedPost.postAuthorName || "Unknown",
      username: sharedPost.isAnonymous
        ? "anonymous"
        : sharedPost.postAuthorUsername || "user",
      email: null,
      profilePicture: sharedPost.postAuthorAvatar || "",
      verified: false,
    },
    content: sharedPost.postContent || "",
    images: sharedPost.postImage
      ? [
          {
            filename: "",
            url: sharedPost.postImage,
            path: "",
            mimetype: "image/jpeg",
            size: 0,
          },
        ]
      : [],
    tags: [],
    campus: "",
    visibility: "campus" as const,
    isAnonymous: sharedPost.isAnonymous || false,
    isEdited: false,
    editedAt: null,
    createdAt: sharedPost.postCreatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLiked: false,
    likeCount: 0,
    commentCount: 0,
  };

  const hasCaption = message.message && message.message.trim().length > 0;

  return (
    <View style={{ width: 260, alignSelf: "center" }}>
      {/* Shared post card */}
      <PostCard
        post={postData}
        compact={true}
        disableNavigation={true}
        hideActions={true}
        hideTime={true}
        onLikePress={() => {}}
        onCommentPress={() => {}}
        onSharePress={() => {}}
      />

      {/* Caption message bubble below the post */}
      {hasCaption && (
        <View
          style={{
            marginTop: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            alignSelf: isOwnMessage ? "flex-end" : "flex-start",
            backgroundColor: isOwnMessage ? "#8b5cf6" : "#E5E5EA",
            borderBottomRightRadius: isOwnMessage ? 4 : 18,
            borderBottomLeftRadius: isOwnMessage ? 18 : 4,
            maxWidth: "100%",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: isOwnMessage ? "#fff" : "#000",
              fontFamily: "SofiaSans-Regular",
            }}
            numberOfLines={3}
          >
            {message.message}
          </Text>
        </View>
      )}
    </View>
  );
};

// =============================================================================
// Main Component - ChatMessageOptionsModal
// =============================================================================

export default function ChatMessageOptionsModal({
  visible,
  onClose,
  onReply,
  onCopy,
  onForward,
  onDelete,
  onReaction,
  isOwnMessage,
  position,
  selectedReaction,
  message,
  getFullImageUrl,
  formatTime,
  currentUserId,
  DEFAULT_AVATAR,
}: ChatMessageOptionsModalProps) {
  // Stop audio when modal closes
  useEffect(() => {
    if (!visible) AudioManager.stopCurrentSound();
    return () => {
      AudioManager.stopCurrentSound();
    };
  }, [visible]);

  // Close modal and stop audio
  const handleClose = useCallback(() => {
    AudioManager.stopCurrentSound();
    onClose();
  }, [onClose]);

  // ===========================================================================
  // Action Buttons Configuration
  // ===========================================================================

  const actions = useMemo(() => {
    const items: {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      handler: () => void;
      destructive?: boolean;
    }[] = [
      { icon: "return-up-back-outline", label: "Reply", handler: onReply },
      { icon: "copy-outline", label: "Copy", handler: onCopy },
      { icon: "arrow-redo-outline", label: "Forward", handler: onForward },
    ];

    // Only show delete for own messages
    if (isOwnMessage && onDelete) {
      items.push({
        icon: "trash-outline",
        label: "Delete",
        handler: onDelete,
        destructive: true,
      });
    }

    return items;
  }, [isOwnMessage, onReply, onCopy, onForward, onDelete]);

  // ===========================================================================
  // Height & Position Calculations
  // ===========================================================================

  const actionsCount = actions.length;
  const actionsHeight =
    actionsCount * ACTION_HEIGHT + (actionsCount - 1) * ACTION_SEPARATOR_HEIGHT;

  const hasValidReply = isValidReply(message.replyTo);

  // Check if reply is a voice message
  const isReplyVoiceMessage = useMemo(() => {
    if (!message.replyTo) return false;
    const replyType = message.replyTo.type;
    const msgText = message.replyTo.message || "";
    return (
      replyType === "audio" ||
      msgText.includes("Voice message") ||
      (message.replyTo.mediaUrl && message.replyTo.mediaUrl.includes("audio"))
    );
  }, [message.replyTo]);

  /**
   * Calculate the preview height based on message type
   */
  const getPreviewHeight = (): number => {
    // Shared post: dynamic height based on content
    if (isPostMessage(message)) {
      const sharedPost = message.sharedPost;
      let height = 15; // Base: header with avatar + name

      if (sharedPost?.postContent) height += 50; // Text content
      if (sharedPost?.postImage)
        height += 150; // Image
      else height += 15; // Small padding if no image
      if (message.message && message.message.trim().length > 0) height += 50; // Caption

      return height;
    }

    // Image/Video: fixed preview size
    if (isImageMessage(message) || isVideoMessage(message))
      return IMAGE_PREVIEW_HEIGHT + 25;

    // Audio: player height
    if (isAudioMessage(message)) return 70;

    // File: attachment preview height
    if (isFileMessage(message)) return 95;

    // Location: compact preview
    if (isLocationMessage(message)) return 56;

    // Text with reply preview
    if (hasValidReply) return isReplyVoiceMessage ? 130 : 60;

    // Plain text message
    return 66;
  };

  const previewHeight = getPreviewHeight();

  // Check if message is any type of media (for layout purposes)
  const isMediaMessage =
    isImageMessage(message) ||
    isVideoMessage(message) ||
    isFileMessage(message) ||
    isLocationMessage(message) ||
    isPostMessage(message);

  // Total modal height
  const totalHeight =
    REACTION_BAR_HEIGHT +
    previewHeight +
    actionsHeight +
    TOTAL_HEIGHT_PADDING +
    (hasValidReply ? REPLY_PREVIEW_HEIGHT : 0);

  // Horizontal positioning
  const actionsLeft = isOwnMessage
    ? SCREEN_WIDTH - ACTIONS_WIDTH - SIDE_MARGIN
    : SIDE_MARGIN;

  const reactionLeft = isOwnMessage
    ? SCREEN_WIDTH - REACTION_WIDTH - SIDE_MARGIN
    : SIDE_MARGIN;

  /**
   * Calculate the top position for the modal
   * Prefers to show above the message, falls back to below
   */
  const getModalTop = (): number => {
    const spaceAbove = position.y - SAFE_TOP;
    const spaceBelow = SCREEN_HEIGHT - position.y - SAFE_BOTTOM;

    if (spaceAbove >= totalHeight + VERTICAL_OFFSET) {
      return position.y - totalHeight - VERTICAL_OFFSET; // Show above
    }
    if (spaceBelow >= totalHeight + VERTICAL_OFFSET) {
      return position.y + VERTICAL_OFFSET; // Show below
    }
    return (SCREEN_HEIGHT - totalHeight) / 2; // Center on screen
  };

  const modalTop = Math.max(
    SAFE_TOP,
    Math.min(getModalTop(), SCREEN_HEIGHT - totalHeight - SAFE_BOTTOM),
  );

  // Vertical positions for each section
  const reactionBarTop = modalTop;
  const messagePreviewTop = modalTop + REACTION_BAR_HEIGHT;

  // Actions position: below the message preview with consistent gap
  const postOffset = isPostMessage(message) ? POST_MESSAGE_EXTRA_OFFSET : 0;
  const actionsTop =
    messagePreviewTop +
    previewHeight +
    (hasValidReply ? REPLY_PREVIEW_HEIGHT : 0) +
    GAP_BETWEEN_PREVIEW_AND_ACTIONS +
    postOffset;

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  /** Handle reaction press with haptic feedback */
  const handleReactionPress = useCallback(
    (reaction: string) => {
      const shouldRemove = selectedReaction === reaction;
      if (shouldRemove) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onReaction(reaction, shouldRemove);
      handleClose();
    },
    [selectedReaction, onReaction, handleClose],
  );

  /** Handle action button press with haptic feedback */
  const handleActionPress = useCallback(
    (handler: () => void, destructive?: boolean) => {
      if (destructive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      handler();
      handleClose();
    },
    [handleClose],
  );

  // ===========================================================================
  // Data Helpers
  // ===========================================================================

  /** Get reply data for the reply preview */
  const getReplyData = (): ReplyTo | null => {
    if (!hasValidReply) return null;
    return {
      messageId: message.replyTo!.messageId,
      message: message.replyTo!.message,
      senderName: message.replyTo!.senderName,
      senderId: message.replyTo!.senderId,
      type: message.replyTo!.type,
      mediaUrl: message.replyTo!.mediaUrl,
      thumbnailUrl: message.replyTo!.thumbnailUrl,
      duration: message.replyTo!.duration,
    };
  };

  /** Format the message timestamp */
  const getFormattedTime = (): string => {
    if (message.createdAt && formatTime) return formatTime(message.createdAt);
    if (message.createdAt) {
      const date = new Date(message.createdAt);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  };

  /** Resolve a relative URL to a full URL */
  const resolveUrl = (url?: string): string => {
    if (!url) return "";
    return getFullImageUrl ? getFullImageUrl(url) : url;
  };

  /** Get the preview URL for image/video messages */
  const getPreviewUrl = (): string => {
    if (isVideoMessage(message)) {
      if (message.thumbnailUrl) return resolveUrl(message.thumbnailUrl);
      if (message.mediaUrl) return resolveUrl(message.mediaUrl);
    }
    if (isImageMessage(message) && message.mediaUrl) {
      return resolveUrl(message.mediaUrl);
    }
    return "";
  };

  // ===========================================================================
  // Render: Message Content
  // ===========================================================================

  /** Render the appropriate preview based on message type */
  const renderMessageContent = () => {
    // Shared post
    if (isPostMessage(message)) {
      return (
        <SharedPostPreview message={message} isOwnMessage={isOwnMessage} />
      );
    }

    // Image or video
    const previewUrl = getPreviewUrl();
    const showPlay = isVideoMessage(message) && !!previewUrl;
    if ((isImageMessage(message) || isVideoMessage(message)) && previewUrl) {
      return <MediaPreview uri={previewUrl} showPlayButton={showPlay} />;
    }

    // Audio
    if (isAudioMessage(message)) {
      return <AudioPreview message={message} isOwnMessage={isOwnMessage} />;
    }

    // File
    if (isFileMessage(message)) {
      return <FilePreview message={message} isOwnMessage={isOwnMessage} />;
    }

    // Location
    if (isLocationMessage(message)) {
      return <LocationPreview isOwnMessage={isOwnMessage} />;
    }

    // Plain text
    return (
      <Text
        style={[
          styles.messageText,
          isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
        ]}
      >
        {message.message}
      </Text>
    );
  };

  const replyData = getReplyData();

  // ===========================================================================
  // Render: Main Modal
  // ===========================================================================

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      {/* Backdrop - tap to close */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleClose}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dimLayer]} />
      </TouchableOpacity>

      {/* ===== Reaction Bar ===== */}
      <View
        style={[
          styles.reactionContainer,
          { top: reactionBarTop, left: reactionLeft },
        ]}
      >
        {REACTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            onPress={() => handleReactionPress(emoji)}
            activeOpacity={0.7}
            style={styles.reactionItem}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {selectedReaction === emoji && (
              <View style={styles.selectedIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ===== Message Preview ===== */}
      <View
        style={[
          styles.messageWrapper,
          { top: messagePreviewTop, left: 0, right: 0, alignItems: "center" },
        ]}
      >
        {/* Shared post layout */}
        {isPostMessage(message) ? (
          <View style={styles.mediaPreviewContainer}>
            {replyData && (
              <View style={styles.replyPreviewWrapperCenter}>
                <ReplyPreview
                  replyTo={replyData}
                  isOwnMessage={isOwnMessage}
                  currentUserId={currentUserId}
                  onScrollToMessage={undefined}
                />
              </View>
            )}
            <View style={[styles.mediaContentWrapper, { width: 270 }]}>
              {renderMessageContent()}
            </View>
            <View style={styles.mediaTimeFooter}>
              <Text style={styles.timeText}>{getFormattedTime()}</Text>
            </View>
          </View>
        ) : /* Media message layout (image, video, file, location) */
        isMediaMessage ? (
          <View style={styles.mediaPreviewContainer}>
            {replyData && (
              <View style={styles.replyPreviewWrapperCenter}>
                <ReplyPreview
                  replyTo={replyData}
                  isOwnMessage={isOwnMessage}
                  currentUserId={currentUserId}
                  onScrollToMessage={undefined}
                />
              </View>
            )}
            <View style={styles.mediaContentWrapper}>
              {renderMessageContent()}
            </View>
            <View style={styles.mediaTimeFooter}>
              <Text style={styles.timeText}>{getFormattedTime()}</Text>
            </View>
          </View>
        ) : (
          /* Text message layout */
          <View
            style={[
              styles.messageRow,
              isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
            ]}
          >
            {!isOwnMessage && <View style={styles.avatarSpacer} />}
            {isOwnMessage && <View style={styles.avatarSpacerRight} />}

            <View style={styles.messageContent}>
              {/* Reply preview */}
              {replyData && (
                <View
                  style={[
                    isOwnMessage
                      ? styles.replyPreviewWrapperOwn
                      : styles.replyPreviewWrapperOther,
                  ]}
                >
                  <ReplyPreview
                    replyTo={replyData}
                    isOwnMessage={isOwnMessage}
                    currentUserId={currentUserId}
                    onScrollToMessage={undefined}
                  />
                </View>
              )}

              {/* Message bubble */}
              <View
                style={[
                  styles.bubble,
                  isOwnMessage ? styles.ownBubble : styles.otherBubble,
                  styles.bubbleAutoWidth,
                  isOwnMessage
                    ? styles.ownBubbleAlignment
                    : { alignSelf: "flex-start" },
                ]}
              >
                {renderMessageContent()}
              </View>

              {/* Timestamp */}
              <View
                style={[
                  styles.messageFooter,
                  isOwnMessage && styles.ownMessageFooter,
                ]}
              >
                <Text style={styles.timeText}>{getFormattedTime()}</Text>
              </View>
            </View>

            {isOwnMessage && <View style={styles.avatarSpacer} />}
          </View>
        )}
      </View>

      {/* ===== Action Buttons ===== */}
      <View
        style={[
          styles.actionsContainer,
          { top: actionsTop, left: actionsLeft },
        ]}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.label}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() =>
                handleActionPress(action.handler, action.destructive)
              }
              activeOpacity={0.65}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? "#FF3B30" : "#8B5CF6"}
              />
              <Text
                style={[
                  styles.actionLabel,
                  action.destructive && styles.actionLabelDestructive,
                ]}
              >
                {action.label}
              </Text>
            </TouchableOpacity>
            {index < actions.length - 1 && (
              <View style={styles.actionSeparator} />
            )}
          </React.Fragment>
        ))}
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  // Backdrop
  dimLayer: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
  },

  // Reaction bar
  reactionContainer: {
    position: "absolute",
    width: REACTION_WIDTH,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  reactionItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    position: "relative",
  },
  reactionEmoji: {
    fontSize: 26,
  },
  selectedIndicator: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    marginLeft: 5,
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#8B5CF6",
  },

  // Message wrapper
  messageWrapper: {
    position: "absolute",
    marginVertical: 4,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  ownMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  avatarSpacer: {
    width: 40,
  },
  avatarSpacerRight: {
    width: 40,
  },
  messageContent: {
    maxWidth: MAX_BUBBLE_WIDTH,
  },

  // Media preview
  mediaPreviewContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  replyPreviewWrapperCenter: {
    alignSelf: "center",
    marginBottom: 8,
  },
  mediaContentWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTimeFooter: {
    alignItems: "center",
    marginTop: 8,
  },
  replyPreviewWrapperOwn: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  replyPreviewWrapperOther: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },

  // Message bubble
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleAutoWidth: {
    alignSelf: "flex-start",
  },
  ownBubbleAlignment: {
    alignSelf: "flex-end",
  },
  ownBubble: {
    backgroundColor: "#8b5cf6",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#E5E5EA",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
  },
  ownMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#000",
  },

  // Media preview box
  mediaPreviewBox: {
    width: IMAGE_PREVIEW_WIDTH,
    height: IMAGE_PREVIEW_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E5EA",
  },
  mediaPreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  mediaLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 12,
    zIndex: 1,
  },
  mediaPlaceholder: {
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
  },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Audio
  audioMessageContainer: {
    minWidth: 200,
    maxWidth: 250,
  },
  audioLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 150,
  },
  audioLoadingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  audioLabel: {
    fontSize: 12,
    color: "#000",
    opacity: 0.7,
    fontFamily: "SofiaSans-Regular",
  },

  // File
  filePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
    minWidth: IMAGE_PREVIEW_WIDTH * 0.8,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
    marginBottom: 3,
  },

  // Location
  locationPreviewContainer: {
    borderRadius: 16,
    padding: 16,
    minWidth: IMAGE_PREVIEW_WIDTH * 0.8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },

  // Message footer
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  ownMessageFooter: {
    justifyContent: "flex-end",
  },
  timeText: {
    fontSize: 10,
    color: "#4b4b4b",
    fontFamily: "SofiaSans-Regular",
  },

  // Action buttons
  actionsContainer: {
    position: "absolute",
    width: ACTIONS_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 16,
  },
  actionSeparator: {
    height: 0.5,
    backgroundColor: "#E5E5EA",
    marginLeft: 16,
  },
  actionLabel: {
    fontSize: 15,
    color: "#1C1C1E",
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  actionLabelDestructive: {
    color: "#FF3B30",
  },
});
