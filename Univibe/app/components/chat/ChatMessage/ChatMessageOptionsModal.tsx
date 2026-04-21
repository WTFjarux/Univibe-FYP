// app/components/chat/ChatMessage/ChatMessageOptionsModal.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import ReplyPreview from "./ReplyPreview";

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

  // Check if reply is voice message
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

  // ─── Total modal height (dynamic based on content) ───────────────────────
  const getEstimatedBubbleHeight = (): number => {
    if (message.type === "image") return 150;
    if (message.type === "audio") return 70;
    if (hasValidReply) {
      if (isReplyVoiceMessage) return 130;
      return 100;
    }
    return 56;
  };

  const estimatedBubbleHeight = getEstimatedBubbleHeight();
  const totalHeight =
    REACTION_BAR_HEIGHT + estimatedBubbleHeight + actionsHeight + 20;

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

  // Final safety clamps
  modalTop = Math.max(
    SAFE_TOP,
    Math.min(modalTop, SCREEN_HEIGHT - totalHeight - SAFE_BOTTOM),
  );

  // ─── 3. SECTION POSITIONS ─────────────────────────────────────────────────
  const reactionBarTop = modalTop;
  const messagePreviewTop = modalTop + REACTION_BAR_HEIGHT;
  const actionsTop = messagePreviewTop + estimatedBubbleHeight + 15;

  // ─── Handle reaction press ────────────────────────────────────────────────
  const handleReactionPress = (reaction: string) => {
    const shouldRemove = selectedReaction === reaction;

    if (shouldRemove) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    onReaction(reaction, shouldRemove);
    onClose();
  };

  // ─── Prepare reply data for ReplyPreview component ───────────────────────
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

  // ─── Format time function ────────────────────────────────────────────────
  const getFormattedTime = (): string => {
    if (message.createdAt && formatTime) {
      return formatTime(message.createdAt);
    }
    if (message.createdAt) {
      // Fallback formatting
      const date = new Date(message.createdAt);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return "";
  };

  // ─── Render main message content (matches ChatBubble exactly) ────────────
  const renderMessageContent = () => {
    if (message.type === "image" && message.mediaUrl && getFullImageUrl) {
      return (
        <Image
          source={{ uri: getFullImageUrl(message.mediaUrl) }}
          style={styles.messageImage}
          resizeMode="cover"
        />
      );
    }

    if (message.type === "audio") {
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
            <Text
              style={[styles.audioLabel, isOwnMessage && styles.ownAudioLabel]}
            >
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

  // ─── Render ────────────────────────────────────────────────────────────────
  const replyData = getReplyData();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
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

      {/* 2. MESSAGE PREVIEW - Align based on message owner */}
      <View
        style={[
          styles.messageWrapper,
          {
            top: messagePreviewTop,
            left: isOwnMessage ? undefined : SIDE_MARGIN,
            right: isOwnMessage ? SIDE_MARGIN : undefined,
          },
        ]}
      >
        <View
          style={[
            styles.messageRow,
            isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
          ]}
        >
          {/* Avatar spacer - show on left for other messages */}
          {!isOwnMessage && <View style={styles.avatarSpacer} />}

          {/* For own messages, avatar spacer goes on the right side */}
          {isOwnMessage && <View style={styles.avatarSpacerRight} />}

          {/* Message Content */}
          <View style={styles.messageContent}>
            {replyData && (
              <View
                style={[
                  isOwnMessage
                    ? styles.replyPreviewWrapperOwn
                    : styles.replyPreviewWrapperOther,
                ]}
              >
                <View style={styles.replyPreviewInner}>
                  <ReplyPreview
                    replyTo={replyData}
                    isOwnMessage={isOwnMessage}
                    currentUserId={currentUserId}
                    onScrollToMessage={undefined}
                  />
                </View>
              </View>
            )}

            {/* Message Bubble */}
            <View
              style={[
                styles.bubble,
                isOwnMessage ? styles.ownBubble : styles.otherBubble,
                message.type !== "audio" && styles.bubbleAutoWidth,
                isOwnMessage
                  ? styles.ownBubbleAlignment
                  : { alignSelf: "flex-start" },
              ]}
            >
              {renderMessageContent()}
            </View>

            {/* Time and Status */}
            <View
              style={[
                styles.messageFooter,
                isOwnMessage && styles.ownMessageFooter,
              ]}
            >
              <Text style={styles.timeText}>{getFormattedTime()}</Text>
            </View>
          </View>

          {/* For own messages, add spacer on the right side after content */}
          {isOwnMessage && <View style={styles.avatarSpacer} />}
        </View>
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
              onPress={() => {
                if (action.destructive) {
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Warning,
                  );
                } else {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                action.handler();
                onClose();
              }}
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
    backgroundColor: "rgba(0,0,0,0.3)",
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

  // Reply Preview Wrappers
  replyPreviewWrapperOwn: {
    alignSelf: "flex-end",
    marginBottom: 8,
  },
  replyPreviewWrapperOther: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  replyPreviewInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    paddingLeft: 8,
    paddingTop: 5,
    paddingRight: 60,
  },

  // Bubble Styles
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

  // Image Preview
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
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
  ownAudioLabel: {
    color: "#fff",
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
    color: "#e6e4e4",
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
