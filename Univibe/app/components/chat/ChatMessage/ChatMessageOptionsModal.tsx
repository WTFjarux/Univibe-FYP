// app/components/chat/ChatMessage/ChatMessageOptionsModal.tsx (DECREASED HEIGHT & ORIGINAL COLORS)

import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];
const ELEMENT_WIDTH = 300;
const REACTION_WIDTH = ELEMENT_WIDTH + 40;
const SIDE_MARGIN = 12;
const VERTICAL_OFFSET = 12;
const SAFE_TOP = 60;
const SAFE_BOTTOM = 30;

// Fixed heights
const REACTION_BAR_HEIGHT = 56;
const MESSAGE_PREVIEW_HEIGHT = 72;
const REPLY_PREVIEW_HEIGHT = 45; // Decreased height
const ACTION_HEIGHT = 48;
const ACTION_SEPARATOR_HEIGHT = 0.5;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  _id: string;
  message: string;
  type?: string;
  mediaUrl?: string;
  senderName?: string;
  senderAvatar?: string;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
    type?: string;
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
}

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

  // ─── Check if message has reply preview ───────────────────────────────────
  const hasReplyPreview = !!message.replyTo;

  // Adjust message preview height if reply exists
  const actualMessagePreviewHeight = hasReplyPreview
    ? MESSAGE_PREVIEW_HEIGHT + REPLY_PREVIEW_HEIGHT
    : MESSAGE_PREVIEW_HEIGHT;

  // ─── Total modal height ──────────────────────────────────────────────────
  const totalHeight =
    REACTION_BAR_HEIGHT + actualMessagePreviewHeight + actionsHeight;

  // ─── 1. HORIZONTAL POSITIONING ───────────────────────────────────────────
  const modalLeft = isOwnMessage
    ? SCREEN_WIDTH - ELEMENT_WIDTH - SIDE_MARGIN
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
  const actionsTop = messagePreviewTop + actualMessagePreviewHeight;

  // ─── 4. ALIGNMENT FOR MESSAGE BUBBLE ─────────────────────────────────────
  const bubbleAlignment = isOwnMessage ? "flex-end" : "flex-start";
  const bubbleStyle = isOwnMessage
    ? styles.ownMessageBubble
    : styles.otherMessageBubble;

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

  // ─── Render reply preview ─────────────────────────────────────────────────
  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    const getReplyPreviewText = () => {
      if (!message.replyTo) return "";
      if (message.replyTo.type === "image") return "📷 Photo";
      if (message.replyTo.type === "audio") return "🎤 Voice message";
      const replyText = message.replyTo.message || "";
      return replyText.length > 100
        ? replyText.substring(0, 100) + "..."
        : replyText;
    };

    const replyText = getReplyPreviewText();

    if (!replyText) return null;

    return (
      <View style={styles.replyPreviewContainer}>
        <View style={styles.replyIndicator} />
        <View style={styles.replyContent}>
          <Text
            style={[
              styles.replySender,
              isOwnMessage ? styles.ownReplySender : styles.otherReplySender,
            ]}
            numberOfLines={1}
          >
            {message.replyTo.senderName || "Unknown"}
          </Text>
          <Text
            style={styles.replyMessage}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {replyText}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Render main message content ─────────────────────────────────────────
  const renderMainContent = () => {
    if (message.type === "image" && message.mediaUrl && getFullImageUrl) {
      return (
        <Image
          source={{ uri: getFullImageUrl(message.mediaUrl) }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      );
    }

    if (message.type === "audio") {
      return (
        <View style={styles.audioPreview}>
          <View style={styles.audioIconWrap}>
            <Ionicons
              name="mic"
              size={16}
              color={isOwnMessage ? "#FFFFFF" : "#8B5CF6"}
            />
          </View>
          <View style={styles.audioWaveform}>
            {[10, 18, 14, 22, 10, 16, 12].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: h,
                    backgroundColor: isOwnMessage
                      ? "rgba(255,255,255,0.7)"
                      : "#8B5CF6",
                  },
                ]}
              />
            ))}
          </View>
          <Text
            style={[
              styles.audioLabel,
              isOwnMessage ? styles.ownAudioLabel : styles.otherAudioLabel,
            ]}
          >
            Voice message
          </Text>
        </View>
      );
    }

    return (
      <Text
        style={[
          styles.previewText,
          isOwnMessage ? styles.ownPreviewText : styles.otherPreviewText,
        ]}
        numberOfLines={3}
      >
        {message.message}
      </Text>
    );
  };

  // ─── Render message preview ───────────────────────────────────────────────
  const renderMessagePreview = () => (
    <View style={styles.previewWrapper}>
      {renderReplyPreview()}
      <View style={styles.mainMessageContent}>{renderMainContent()}</View>
    </View>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
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

      {/* 2. MESSAGE PREVIEW */}
      <View
        style={[
          styles.messagePreviewContainer,
          {
            top: messagePreviewTop,
            left: modalLeft,
            alignItems: bubbleAlignment,
          },
        ]}
      >
        <View style={[styles.messageBubble, bubbleStyle]}>
          {renderMessagePreview()}
        </View>
      </View>

      {/* 3. ACTIONS LIST */}
      <View
        style={[styles.actionsContainer, { top: actionsTop, left: modalLeft }]}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    bottom: -4,
    left: "50%",
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#8B5CF6",
  },

  // Message Preview
  messagePreviewContainer: {
    position: "absolute",
    width: ELEMENT_WIDTH,
  },
  messageBubble: {
    width: ELEMENT_WIDTH - 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  ownMessageBubble: {
    backgroundColor: "#8B5CF6",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#E5E5EA",
    borderBottomLeftRadius: 4,
  },

  // Reply Preview Styles (DECREASED HEIGHT & ORIGINAL COLORS)
  previewWrapper: {
    width: "100%",
  },
  replyPreviewContainer: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
    minHeight: 45,
    width: "100%",
  },
  replyIndicator: {
    width: 3,
    backgroundColor: "#8B5CF6",
    borderRadius: 2,
    marginRight: 8,
    alignSelf: "stretch",
  },
  replyContent: {
    flex: 1,
    justifyContent: "center",
    flexShrink: 1,
  },
  replySender: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    fontFamily: "SofiaSans-Bold",
  },
  ownReplySender: {
    color: "rgba(255,255,255,0.9)",
  },
  otherReplySender: {
    color: "#8B5CF6",
  },
  replyMessage: {
    fontSize: 11,
    color: "#8E8E93",
    lineHeight: 14,
    fontFamily: "SofiaSans-Regular",
    flexShrink: 1,
    flexWrap: "wrap",
  },
  mainMessageContent: {
    width: "100%",
  },

  // Text Preview
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
  },
  ownPreviewText: {
    color: "#FFFFFF",
  },
  otherPreviewText: {
    color: "#000000",
  },

  // Image Preview
  previewImage: {
    width: ELEMENT_WIDTH - 60,
    height: 120,
    borderRadius: 12,
  },

  // Audio Preview
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 180,
  },
  audioIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  audioWaveform: {
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
    fontFamily: "SofiaSans-Regular",
  },
  ownAudioLabel: {
    color: "#FFFFFF",
  },
  otherAudioLabel: {
    color: "#8E8E93",
  },

  // Actions Container
  actionsContainer: {
    position: "absolute",
    width: ELEMENT_WIDTH,
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
