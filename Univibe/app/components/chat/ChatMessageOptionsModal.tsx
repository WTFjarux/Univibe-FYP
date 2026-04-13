// app/components/chat/ChatMessageOptionsModal.tsx
//
// Messenger-style message options modal.
// Layout: floating reaction pill → highlighted message bubble → action list
//

import React from "react";
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

// ─── Constants ───────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

/** Width of the floating panel */
const PANEL_WIDTH = 260;

/** Approximate heights for layout math */
const REACTION_BAR_HEIGHT = 56;
const MESSAGE_PREVIEW_MAX_HEIGHT = 160;
const ACTION_ITEM_HEIGHT = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  _id: string;
  message: string;
  type?: string;
  mediaUrl?: string;
  senderName?: string;
}

interface ChatMessageOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete?: () => void;
  onReaction: (reaction: string) => void;
  isOwnMessage: boolean;
  position: { x: number; y: number };
  selectedReaction?: string | null;
  message: Message;
  getFullImageUrl?: (url: string) => string;
}

// ─── Sub-component: single reaction bubble ────────────────────────────────────

interface ReactionBubbleProps {
  emoji: string;
  isSelected: boolean;
  onPress: (emoji: string) => void;
}

function ReactionBubble({ emoji, isSelected, onPress }: ReactionBubbleProps) {
  return (
    <TouchableOpacity onPress={() => onPress(emoji)} activeOpacity={0.7}>
      <View
        style={[
          styles.reactionBubble,
          isSelected && styles.reactionBubbleSelected,
        ]}
      >
        <Text style={styles.reactionEmoji}>{emoji}</Text>
      </View>
    </TouchableOpacity>
  );
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
  // ── Position clamping ────────────────────────────────────────────────────
  // Estimate total panel height to decide if it should render above/below the tap
  const actionCount = isOwnMessage && onDelete ? 4 : 3;
  const estimatedPanelHeight =
    REACTION_BAR_HEIGHT +
    MESSAGE_PREVIEW_MAX_HEIGHT +
    actionCount * ACTION_ITEM_HEIGHT +
    80; // padding

  let top = position.y - REACTION_BAR_HEIGHT - 16; // default: render above tap
  if (top < 80) top = position.y + 16; // flip below if overflowing top
  if (top + estimatedPanelHeight > SCREEN_HEIGHT - 20) {
    top = SCREEN_HEIGHT - estimatedPanelHeight - 20;
  }

  let left = position.x - PANEL_WIDTH / 2;
  if (left < 12) left = 12;
  if (left + PANEL_WIDTH > SCREEN_WIDTH - 12)
    left = SCREEN_WIDTH - PANEL_WIDTH - 12;

  // ── Message preview ───────────────────────────────────────────────────────
  const renderMessagePreview = () => {
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
            <Ionicons name="mic" size={16} color="#fff" />
          </View>
          <View style={styles.audioWaveform}>
            {[10, 18, 14, 22, 10, 16, 12].map((h, i) => (
              <View key={i} style={[styles.waveBar, { height: h }]} />
            ))}
          </View>
          <Text style={styles.audioLabel}>Voice message</Text>
        </View>
      );
    }
    return <Text style={styles.previewText}>{message.message}</Text>;
  };

  // ── Action items config ───────────────────────────────────────────────────
  const actions: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    handler: () => void;
    destructive?: boolean;
  }[] = [
    { icon: "return-up-back-outline", label: "Reply", handler: onReply },
    { icon: "copy-outline", label: "Copy", handler: onCopy },
    { icon: "arrow-redo-outline", label: "Forward", handler: onForward },
    ...(isOwnMessage && onDelete
      ? [
          {
            icon: "trash-outline" as const,
            label: "Delete",
            handler: onDelete,
            destructive: true,
          },
        ]
      : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Dimmed blurred overlay — tap anywhere outside to close */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dimLayer]} />
      </TouchableOpacity>

      {/* Floating panel — absorbs taps so they don't bubble to the overlay */}
      <View
        style={[styles.panel, { top, left }]}
        onStartShouldSetResponder={() => true}
      >
        {/* ── 1. Reaction pill ─────────────────────────────────────────── */}
        <View style={styles.reactionPill}>
          {REACTIONS.map((emoji) => (
            <ReactionBubble
              key={emoji}
              emoji={emoji}
              isSelected={selectedReaction === emoji}
              onPress={onReaction}
            />
          ))}
        </View>

        {/* ── 2. Message bubble preview ────────────────────────────────── */}
        <View style={styles.messageBubbleWrap}>
          {message.senderName && !isOwnMessage && (
            <Text style={styles.senderName}>{message.senderName}</Text>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? styles.ownBubble : styles.otherBubble,
            ]}
          >
            {renderMessagePreview()}
          </View>
        </View>

        {/* ── 3. Action list ───────────────────────────────────────────── */}
        <View style={styles.actionList}>
          {actions.map((action, index) => (
            <React.Fragment key={action.label}>
              {index > 0 && <View style={styles.actionSeparator} />}
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => {
                  action.handler();
                  onClose();
                }}
                activeOpacity={0.65}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? "#FF453A" : "#EBEBF5"}
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
            </React.Fragment>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  dimLayer: {
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // ── Panel ──────────────────────────────────────────────────────────────────
  panel: {
    position: "absolute",
    width: PANEL_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 20,
  },

  // ── Reaction pill ─────────────────────────────────────────────────────────
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2C2C2E",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  reactionBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3A3A3C",
    justifyContent: "center",
    alignItems: "center",
  },
  reactionBubbleSelected: {
    backgroundColor: "#0A84FF",
    shadowColor: "#0A84FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  reactionEmoji: {
    fontSize: 20,
  },

  // ── Message bubble preview ────────────────────────────────────────────────
  messageBubbleWrap: {
    marginBottom: 10,
    alignSelf: "stretch",
  },
  senderName: {
    fontSize: 11,
    color: "#8E8E93",
    marginBottom: 4,
    marginLeft: 4,
    fontWeight: "500",
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  ownBubble: {
    backgroundColor: "#0A84FF",
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
  },
  otherBubble: {
    backgroundColor: "#2C2C2E",
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
  },
  previewText: {
    fontSize: 15,
    lineHeight: 20,
    color: "#FFFFFF",
    fontFamily: "SofiaSans-Regular",
  },
  previewImage: {
    width: PANEL_WIDTH - 28,
    height: 130,
    borderRadius: 12,
  },
  audioPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  audioWaveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  audioLabel: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.85,
  },

  // ── Action list ───────────────────────────────────────────────────────────
  actionList: {
    backgroundColor: "#2C2C2E",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  actionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#3A3A3C",
    marginHorizontal: 16,
  },
  actionLabel: {
    fontSize: 15,
    color: "#EBEBF5",
    fontWeight: "400",
    fontFamily: "SofiaSans-Regular",
  },
  actionLabelDestructive: {
    color: "#FF453A",
  },
});
