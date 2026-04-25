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
import { Image } from "expo-image"; // 🔴 Use expo-image like AttachmentMessage
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import ReplyPreview from "./ReplyPreview";
import AudioManager from "../../../../lib/utils/AudioManager";

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
const REACTION_WIDTH = 340;
const SIDE_MARGIN = 12;
const VERTICAL_OFFSET = 12;
const SAFE_TOP = 60;
const SAFE_BOTTOM = 30;
const MAX_BUBBLE_WIDTH = SCREEN_WIDTH * 0.75;
const ACTIONS_WIDTH = 220;

// Fixed heights
const REACTION_BAR_HEIGHT = 56;
const ACTION_HEIGHT = 48;
const ACTION_SEPARATOR_HEIGHT = 0.5;

// 🔴 EXACT SAME dimensions as AttachmentMessage
const IMAGE_PREVIEW_WIDTH = SCREEN_WIDTH * 0.55; // Fixed width
const IMAGE_PREVIEW_HEIGHT = IMAGE_PREVIEW_WIDTH * 1.25; // 5:4 aspect ratio portrait

// 🔴 Blurhash for image placeholder (matching AttachmentMessage)
const PHOTO_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

// Waveform constants (matching ChatBubble)
const WAVEFORM_BARS = [10, 18, 14, 22, 10, 16, 12];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReplyTo {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

interface Message {
  _id: string;
  message: string;
  type?: string;
  mediaUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  duration?: number;
  createdAt?: string;
  replyTo?: ReplyTo;
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
}

// ─── Helper Functions ────────────────────────────────────────────────────────

const isValidReply = (reply?: ReplyTo): boolean => {
  return !!(
    reply &&
    reply.messageId &&
    reply.senderName &&
    reply.senderName.trim() !== ""
  );
};

const isImageMessage = (message: Message): boolean => {
  return message.type === "image" && !!message.mediaUrl;
};

const isVideoMessage = (message: Message): boolean => {
  return message.type === "video" && !!message.mediaUrl;
};

const isAudioMessage = (message: Message): boolean => {
  return message.type === "audio";
};

const isFileMessage = (message: Message): boolean => {
  return message.type === "file";
};

const isLocationMessage = (message: Message): boolean => {
  return message.type === "location";
};

// ─── Image Preview Component (EXACTLY like AttachmentMessage ImageBubble) ─────

const ImagePreview = ({ uri }: { uri: string; isOwnMessage: boolean }) => {
  const [loading, setLoading] = useState(true);

  // 🔴 EXACT SAME structure as AttachmentMessage ImageBubble
  return (
    <View style={styles.imagePreviewWrapper}>
      {loading && (
        <View style={styles.imageLoadingOverlay}>
          <ActivityIndicator size="small" color="#007AFF" />
        </View>
      )}
      <Image
        source={{ uri }}
        style={styles.imagePreview}
        placeholder={{ blurhash: PHOTO_BLURHASH }}
        placeholderContentFit="cover"
        transition={400}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoadEnd={() => setLoading(false)}
      />
    </View>
  );
};

// ─── Video Preview Component ───────────────────────────────────────────────────

const VideoPreview = ({ isOwnMessage }: { isOwnMessage: boolean }) => {
  return (
    <View style={styles.videoPreviewWrapper}>
      <View
        style={[
          styles.videoPreviewContainer,
          {
            backgroundColor: isOwnMessage
              ? "rgba(0,0,0,0.15)"
              : "rgba(0,0,0,0.05)",
          },
        ]}
      >
        <View style={styles.videoPlayButton}>
          <Ionicons name="play-circle" size={44} color="#fff" />
        </View>
        <View style={styles.videoInfo}>
          <Ionicons
            name="videocam"
            size={16}
            color={isOwnMessage ? "rgba(255,255,255,0.8)" : "#666"}
          />
          <Text style={[styles.videoText, isOwnMessage && { color: "#fff" }]}>
            Video
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Audio Preview Component ───────────────────────────────────────────────────

const AudioPreview = ({
  message,
  isOwnMessage,
}: {
  message: Message;
  isOwnMessage: boolean;
}) => {
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
                    ? "rgba(255, 255, 255, 0.5)"
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

// ─── File Preview Component ────────────────────────────────────────────────────

const FilePreview = ({
  message,
  isOwnMessage,
}: {
  message: Message;
  isOwnMessage: boolean;
}) => {
  const fileColor = "#8B5CF6";
  const fileName = message.message || "Document";

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
          {fileName}
        </Text>
      </View>
    </View>
  );
};

// ─── Location Preview Component ────────────────────────────────────────────────

const LocationPreview = ({ isOwnMessage }: { isOwnMessage: boolean }) => {
  return (
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
};

// ─── Main Component ───────────────────────────────────────────────────────────

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
}: ChatMessageOptionsModalProps) {
  // 🔴 Stop audio when modal closes or becomes invisible
  useEffect(() => {
    if (!visible) {
      AudioManager.stopCurrentSound();
    }
    return () => {
      AudioManager.stopCurrentSound();
    };
  }, [visible]);

  // 🔴 Handle close with audio cleanup
  const handleClose = useCallback(() => {
    AudioManager.stopCurrentSound();
    onClose();
  }, [onClose]);

  // ─── Calculate number of actions ─────────────────────────────────────────
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

  const actionsCount = actions.length;
  const actionsHeight =
    actionsCount * ACTION_HEIGHT + (actionsCount - 1) * ACTION_SEPARATOR_HEIGHT;

  // ─── Check if message has a valid reply preview ──────────────────────────
  const hasValidReply = isValidReply(message.replyTo);

  const isReplyVoiceMessage = useMemo(() => {
    if (!message.replyTo) return false;
    const replyType = message.replyTo.type;
    const msgText = message.replyTo.message || "";
    return (
      replyType === "audio" ||
      msgText === "🎤 Voice message" ||
      msgText.includes("Voice message") ||
      (message.replyTo.mediaUrl && message.replyTo.mediaUrl.includes("audio"))
    );
  }, [message.replyTo]);

  // ─── 🔴 STRICTLY FIXED preview heights (matching AttachmentMessage) ──────
  const getPreviewHeight = (): number => {
    // 🔴 Image: EXACTLY the same height as AttachmentMessage
    if (isImageMessage(message)) {
      return IMAGE_PREVIEW_HEIGHT; // No extra padding, exact match
    }

    // Video: Same width, fixed height
    if (isVideoMessage(message)) {
      return 160;
    }

    // Audio
    if (isAudioMessage(message)) {
      return 70;
    }

    // File
    if (isFileMessage(message)) {
      return 76;
    }

    // Location
    if (isLocationMessage(message)) {
      return 56;
    }

    // Text with reply
    if (hasValidReply) {
      if (isReplyVoiceMessage) return 130;
      return 100;
    }

    // Plain text
    return 56;
  };

  const previewHeight = getPreviewHeight();
  const isMediaMessage =
    isImageMessage(message) ||
    isVideoMessage(message) ||
    isFileMessage(message) ||
    isLocationMessage(message);

  // 🔴 Consistent spacing
  const mediaExtraSpacing = isMediaMessage ? 32 : 0;

  const totalHeight =
    REACTION_BAR_HEIGHT +
    previewHeight +
    actionsHeight +
    20 +
    mediaExtraSpacing;

  // ─── 1. HORIZONTAL POSITIONING ───────────────────────────────────────────
  const actionsLeft = isOwnMessage
    ? SCREEN_WIDTH - ACTIONS_WIDTH - SIDE_MARGIN
    : SIDE_MARGIN;

  const reactionLeft = isOwnMessage
    ? SCREEN_WIDTH - REACTION_WIDTH - SIDE_MARGIN
    : SIDE_MARGIN;

  // ─── 2. VERTICAL POSITIONING ─────────────────────────────────────────────
  const getModalTop = (): number => {
    const spaceAbove = position.y - SAFE_TOP;
    const spaceBelow = SCREEN_HEIGHT - position.y - SAFE_BOTTOM;

    if (spaceAbove >= totalHeight + VERTICAL_OFFSET) {
      return position.y - totalHeight - VERTICAL_OFFSET;
    }

    if (spaceBelow >= totalHeight + VERTICAL_OFFSET) {
      return position.y + VERTICAL_OFFSET;
    }

    return (SCREEN_HEIGHT - totalHeight) / 2;
  };

  let modalTop = getModalTop();

  // Safety clamps
  modalTop = Math.max(
    SAFE_TOP,
    Math.min(modalTop, SCREEN_HEIGHT - totalHeight - SAFE_BOTTOM),
  );

  // ─── 3. SECTION POSITIONS ─────────────────────────────────────────────────
  const reactionBarTop = modalTop;
  const messagePreviewTop = modalTop + REACTION_BAR_HEIGHT;
  const replyOffset = hasValidReply ? 60 : 0;
  const mediaOffset = isMediaMessage ? 28 : 0;
  const actionsTop =
    messagePreviewTop + previewHeight + replyOffset + mediaOffset;

  // ─── Handle reaction press ────────────────────────────────────────────────
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

  // ─── Handle action press ────────────────────────────────────────────────
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

  // ─── Prepare reply data ──────────────────────────────────────────────
  const getReplyData = (): ReplyTo | null => {
    if (!hasValidReply) return null;
    return {
      messageId: message.replyTo!.messageId,
      message: message.replyTo!.message,
      senderName: message.replyTo!.senderName,
      senderId: message.replyTo!.senderId,
      type: message.replyTo!.type,
      mediaUrl: message.replyTo!.mediaUrl,
      duration: message.replyTo!.duration,
    };
  };

  // ─── Format time ─────────────────────────────────────────────────────
  const getFormattedTime = (): string => {
    if (message.createdAt && formatTime) {
      return formatTime(message.createdAt);
    }
    if (message.createdAt) {
      const date = new Date(message.createdAt);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  };

  // ─── Render message content ──────────────────────────────────────────
  const renderMessageContent = () => {
    if (isImageMessage(message) && message.mediaUrl) {
      const fullUrl = getFullImageUrl
        ? getFullImageUrl(message.mediaUrl)
        : message.mediaUrl;
      return <ImagePreview uri={fullUrl} isOwnMessage={isOwnMessage} />;
    }

    if (isVideoMessage(message)) {
      return <VideoPreview isOwnMessage={isOwnMessage} />;
    }

    if (isAudioMessage(message)) {
      return <AudioPreview message={message} isOwnMessage={isOwnMessage} />;
    }

    if (isFileMessage(message)) {
      return <FilePreview message={message} isOwnMessage={isOwnMessage} />;
    }

    if (isLocationMessage(message)) {
      return <LocationPreview isOwnMessage={isOwnMessage} />;
    }

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

  // ─── Render ──────────────────────────────────────────────────────────
  const replyData = getReplyData();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleClose}
      >
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dimLayer]} />
      </TouchableOpacity>

      {/* 1. REACTION BAR */}
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

      {/* 2. MESSAGE PREVIEW */}
      <View
        style={[
          styles.messageWrapper,
          {
            top: messagePreviewTop,
            left: 0,
            right: 0,
            // 🔴 Always center media messages
            alignItems: "center" as const,
          },
        ]}
      >
        {/* 🔴 Media messages centered */}
        {isMediaMessage ? (
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
          /* 🔴 Text messages keep bubble alignment */
          <View
            style={[
              styles.messageRow,
              isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
            ]}
          >
            {!isOwnMessage && <View style={styles.avatarSpacer} />}
            {isOwnMessage && <View style={styles.avatarSpacerRight} />}

            <View style={styles.messageContent}>
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

      {/* 3. ACTIONS LIST */}
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

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dimLayer: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
  },

  // Reaction Bar
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

  // Message Wrapper
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

  // 🔴 Media Preview Container (centered)
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

  // Reply Preview Wrappers
  replyPreviewWrapperOwn: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  replyPreviewWrapperOther: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },

  // Bubble Styles (for text messages)
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

  // Message Text
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

  // 🔴 Image Preview - EXACT SAME as AttachmentMessage imageWrapper
  imagePreviewWrapper: {
    width: IMAGE_PREVIEW_WIDTH, // SCREEN_WIDTH * 0.55
    height: IMAGE_PREVIEW_HEIGHT, // IMAGE_WIDTH * 1.25
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E5EA",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 12,
    zIndex: 1,
  },

  // 🔴 Video Preview - EXACT SAME width as AttachmentMessage videoContainer
  videoPreviewWrapper: {
    width: IMAGE_PREVIEW_WIDTH, // Same as image width
  },
  videoPreviewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  videoPlayButton: {
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  videoInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  videoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    fontFamily: "SofiaSans-Medium",
  },

  // Audio Preview
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

  // File Preview
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
  fileInfo: { flex: 1 },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
    marginBottom: 3,
  },

  // Location Preview
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

  // Message Footer
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

  // Actions Container
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
