// app/components/chat/ChatMessage/ChatBubble.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Share,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import AttachmentMessage from "./AttachmentMessage";
import ChatImageViewer from "./ChatImageViewer";
import ChatMessageOptionsModal from "./ChatMessageOptionsModal";
import ReplyPreview from "./ReplyPreview";

// ─── Types ──────────────────────────────────────────────────────

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read" | "sending";
  type?: "text" | "image" | "audio" | "video" | "file" | "location";
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  mediaMimeType?: string;
  duration?: number;
  locationData?: { latitude: number; longitude: number; locationName?: string };
  reactions?: Array<{ userId: string; reaction: string; createdAt: string }>;
  readBy?: Array<{ user: string; readAt: string }>;
  deliveredTo?: Array<{ user: string; deliveredAt: string }>;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
    duration?: number;
  };
}

interface ChatBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showTime: boolean;
  formatTime: (dateString: string) => string;
  getFullImageUrl: (url: string) => string;
  DEFAULT_AVATAR: any;
  onAudioPlayed?: (messageId: string) => void;
  onReaction?: (
    messageId: string,
    reaction: string,
    shouldRemove?: boolean,
  ) => void;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  currentUserId?: string;
  highlightedMessageId?: string;
  onScrollToMessage?: (messageId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────

export default function ChatBubble({
  message,
  isOwnMessage,
  showAvatar,
  showTime,
  formatTime,
  getFullImageUrl,
  DEFAULT_AVATAR,
  onAudioPlayed,
  onReaction,
  onReply,
  onDelete,
  onForward,
  currentUserId,
  highlightedMessageId,
  onScrollToMessage,
}: ChatBubbleProps) {
  // Modal & interaction state
  const [showOptions, setShowOptions] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Highlight animation when message is navigated to
  const isHighlighted = highlightedMessageId === message._id;
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      highlightAnim.setValue(0);
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.delay(2000),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      highlightAnim.setValue(0);
    }
  }, [isHighlighted]);

  // Check if message contains media
  const isMediaType = ["image", "video", "file", "location"].includes(
    message.type || "",
  );

  // ─── Avatar ──────────────────────────────────────────────────

  const getAvatarSource = () => {
    if (avatarError) return DEFAULT_AVATAR;
    if (message.senderAvatar) {
      const fullUrl = getFullImageUrl(message.senderAvatar);
      if (fullUrl && fullUrl.length > 0) return { uri: fullUrl };
    }
    return DEFAULT_AVATAR;
  };

  // ─── Reactions ───────────────────────────────────────────────

  const currentUserReaction = message.reactions?.find(
    (r) => r.userId === currentUserId,
  )?.reaction;

  // Group reactions by emoji for display
  const reactionGroups = message.reactions?.reduce(
    (acc, r) => {
      acc[r.reaction] = (acc[r.reaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ─── Message Status Helpers ──────────────────────────────────

  const getSenderId = (): string => {
    return typeof message.sender === "string"
      ? message.sender
      : message.sender?._id || "";
  };

  // Check if message was read by someone other than sender
  const isMessageRead = (): boolean => {
    if (!isOwnMessage || !message.readBy || message.readBy.length === 0)
      return false;
    const senderId = getSenderId();
    return message.readBy.some((r: any) => {
      const readUserId = typeof r === "string" ? r : r.user || r.userId;
      return readUserId?.toString() !== senderId?.toString();
    });
  };

  // Check if message was delivered to someone other than sender
  const isMessageDelivered = (): boolean => {
    if (
      !isOwnMessage ||
      !message.deliveredTo ||
      message.deliveredTo.length === 0
    )
      return false;
    const senderId = getSenderId();
    return message.deliveredTo.some((r: any) => {
      const deliveredUserId = typeof r === "string" ? r : r.user || r.userId;
      return deliveredUserId?.toString() !== senderId?.toString();
    });
  };

  // Status icon based on message state
  const getMessageStatusIcon = () => {
    if (!isOwnMessage) return null;

    if (message.status === "sending") {
      return <ActivityIndicator size={10} color="#8E8E93" />;
    }

    if (isMessageRead() || message.status === "read") {
      return (
        <View style={styles.statusIconContainer}>
          <Ionicons name="checkmark-done" size={14} color="#34C759" />
        </View>
      );
    }

    if (isMessageDelivered() || message.status === "delivered") {
      return (
        <View style={styles.statusIconContainer}>
          <Ionicons name="checkmark-done" size={14} color="#8E8E93" />
        </View>
      );
    }

    return (
      <View style={styles.statusIconContainer}>
        <Ionicons name="checkmark" size={14} color="#8E8E93" />
      </View>
    );
  };

  // Status text for accessibility
  const getStatusText = (): string => {
    if (!isOwnMessage) return "";
    if (message.status === "sending") return "Sending...";
    if (isMessageRead() || message.status === "read") return "Read";
    if (isMessageDelivered() || message.status === "delivered")
      return "Delivered";
    return "Sent";
  };

  // ─── Action Handlers ─────────────────────────────────────────

  // Long press opens options modal
  const handleLongPress = (event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { pageX, pageY } = event.nativeEvent;
    setOptionsPosition({ x: pageX - 100, y: pageY - 80 });
    setShowOptions(true);
  };

  // Copy message text to clipboard
  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.message);
    setShowOptions(false);
  };

  // Reply to this message
  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onReply) onReply(message);
    setShowOptions(false);
  };

  // Delete this message
  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowOptions(false);
    if (onDelete) onDelete(message._id);
  };

  // Forward this message
  const handleForward = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onForward) onForward(message);
    else await Share.share({ message: message.message });
    setShowOptions(false);
  };

  // React to this message
  const handleReaction = (reaction: string, shouldRemove?: boolean) => {
    if (shouldRemove) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedReaction(shouldRemove ? null : reaction);
    if (onReaction) onReaction(message._id, reaction, shouldRemove);
    setShowOptions(false);
  };

  // Open image in full-screen viewer
  const handleImagePress = (url: string) => {
    setViewerImages([url]);
    setViewerIndex(0);
    setImageViewerVisible(true);
  };

  // ─── Render Message Content ──────────────────────────────────

  const renderMessageContent = () => {
    // Media messages (image, video, file, location)
    if (isMediaType) {
      return (
        <AttachmentMessage
          type={
            (message.type as "image" | "video" | "file" | "location") || "file"
          }
          mediaUrl={
            message.mediaUrl ? getFullImageUrl(message.mediaUrl) : undefined
          }
          thumbnailUrl={message.thumbnailUrl}
          mediaName={message.mediaName}
          mediaSize={message.mediaSize}
          locationData={message.locationData}
          isOwnMessage={isOwnMessage}
          onImagePress={(url) => handleImagePress(url)}
          onFilePress={(url, name) => console.log("Open file:", url, name)}
          onLocationPress={(lat, lng) =>
            console.log("Open location:", lat, lng)
          }
          onLongPress={handleLongPress}
        />
      );
    }

    // Audio message - loading state
    if (
      message.type === "audio" &&
      (message.status === "sending" || !message.mediaUrl)
    ) {
      return (
        <View style={styles.audioLoadingContainer}>
          <View style={styles.audioLoadingIconWrap}>
            <ActivityIndicator
              size="small"
              color={isOwnMessage ? "#fff" : "#585858"}
            />
          </View>
          <View style={styles.waveformContainer}>
            {[10, 18, 14, 22, 10, 16, 12].map((h, i) => (
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

    // Audio message - ready
    if (message.type === "audio") {
      return (
        <View style={styles.audioMessageContainer}>
          <AudioPlayer
            audioUrl={message.mediaUrl || ""}
            duration={message.duration || 0}
            isOwnMessage={isOwnMessage}
            messageId={message._id}
            onPlayed={onAudioPlayed}
          />
        </View>
      );
    }

    // Text message
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

  // ─── Reply Data for Modal ────────────────────────────────────

  const getReplyDataForModal = () => {
    if (!message.replyTo) return undefined;
    return {
      messageId: message.replyTo.messageId,
      message: message.replyTo.message,
      senderName: message.replyTo.senderName,
      senderId: message.replyTo.senderId,
      type: message.replyTo.type,
      mediaUrl: message.replyTo.mediaUrl,
      duration: message.replyTo.duration,
    };
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <>
      {/* Message row with avatar and content */}
      <View style={styles.messageWrapper}>
        {/* Highlight animation background */}
        <Animated.View
          style={[
            styles.highlightBackground,
            {
              opacity: highlightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.15],
              }),
            },
          ]}
        />

        <View
          style={[
            styles.messageRow,
            isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
          ]}
        >
          {/* Avatar - shown only for other people's messages */}
          {!isOwnMessage && showAvatar && (
            <View style={styles.avatarContainer}>
              <Image
                source={getAvatarSource()}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
            </View>
          )}

          {/* Avatar spacer - maintains alignment when no avatar */}
          {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}
          {isOwnMessage && <View style={styles.avatarSpacer} />}

          {/* Message content container */}
          <View style={styles.messageContent}>
            {/* Reply preview */}
            {message.replyTo && (
              <ReplyPreview
                replyTo={{
                  messageId: message.replyTo.messageId,
                  message: message.replyTo.message,
                  senderName: message.replyTo.senderName,
                  senderId: message.replyTo.senderId,
                  type: message.replyTo.type,
                  mediaUrl: message.replyTo.mediaUrl,
                  duration: message.replyTo.duration,
                }}
                isOwnMessage={isOwnMessage}
                currentUserId={currentUserId}
                onScrollToMessage={onScrollToMessage}
              />
            )}

            {/* Message bubble - only this area is long-pressable */}
            <Pressable
              onLongPress={handleLongPress}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.bubble,
                // Text/audio messages get auto-width and colored background
                (!isMediaType || message.type === "audio") &&
                  styles.bubbleAutoWidth,
                (!isMediaType || message.type === "audio") &&
                  (isOwnMessage ? styles.ownBubble : styles.otherBubble),
                // Media messages get transparent background
                isMediaType && message.type !== "audio" && styles.mediaBubble,
                // Alignment based on message owner
                isOwnMessage ? styles.bubbleAlignRight : styles.bubbleAlignLeft,
                // Press feedback
                pressed && styles.bubblePressed,
              ]}
            >
              {renderMessageContent()}
            </Pressable>

            {/* Reaction badges */}
            {reactionGroups && Object.keys(reactionGroups).length > 0 && (
              <View
                style={[
                  styles.reactionsRow,
                  isOwnMessage && styles.reactionsRowOwn,
                ]}
              >
                {Object.entries(reactionGroups).map(([reaction, count]) => (
                  <View key={reaction} style={styles.reactionBadge}>
                    <Text style={styles.reactionEmoji}>{reaction}</Text>
                    {count > 1 && (
                      <Text style={styles.reactionCount}>{count}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Time and status indicators */}
            {showTime && (
              <View
                style={[
                  styles.messageFooter,
                  isOwnMessage && styles.messageFooterOwn,
                ]}
              >
                <Text style={styles.timeText}>
                  {formatTime(message.createdAt)}
                  {isOwnMessage && ` · ${getStatusText()}`}
                </Text>
                {getMessageStatusIcon()}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Modals remain the same */}
      <ChatMessageOptionsModal
        visible={showOptions}
        onClose={() => setShowOptions(false)}
        onReply={handleReply}
        onCopy={handleCopy}
        onForward={handleForward}
        onDelete={isOwnMessage ? handleDelete : undefined}
        onReaction={handleReaction}
        isOwnMessage={isOwnMessage}
        position={optionsPosition}
        selectedReaction={currentUserReaction || selectedReaction}
        message={{
          _id: message._id,
          message: message.message,
          type: message.type,
          mediaUrl: message.mediaUrl,
          senderName: message.senderName,
          replyTo: getReplyDataForModal(),
          createdAt: message.createdAt,
          duration: message.duration,
        }}
        getFullImageUrl={getFullImageUrl}
        formatTime={formatTime}
        currentUserId={currentUserId}
      />

      <ChatImageViewer
        visible={imageViewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Message wrapper - contains highlight and row
  messageWrapper: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },

  // Highlight animation overlay
  highlightBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#8B5CF6",
    borderRadius: 16,
    zIndex: 0,
  },


  // Press feedback on bubble only
  bubblePressed: { opacity: 0.9 },

  // Message row - avatar + content
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    zIndex: 1,
    padding: 4,
    width: "100%",
  },

  // Row alignment
  ownMessageRow: { justifyContent: "flex-end" },
  otherMessageRow: { justifyContent: "flex-start" },

  // Avatar
  avatarContainer: { marginRight: 8, marginBottom: 4 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },

  // Avatar spacer for alignment when no avatar shown
  avatarSpacer: { width: 40 },

  // Message content - limits width to 75% of screen
  messageContent: {
    maxWidth: "75%",
    flexShrink: 1,
  },

  // Bubble base styles
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },

  // Auto-width for text messages (wraps content)
  bubbleAutoWidth: {
    alignSelf: "flex-start",
  },

  // Bubble alignment
  bubbleAlignRight: {
    alignSelf: "flex-end",
  },
  bubbleAlignLeft: {
    alignSelf: "flex-start",
  },

  // Bubble colors
  ownBubble: {
    backgroundColor: "#8b5cf6",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#E5E5EA",
    borderBottomLeftRadius: 4,
  },

  // Transparent bubble for media messages
  mediaBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },

  // Message text
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
  },
  ownMessageText: { color: "#fff" },
  otherMessageText: { color: "#000" },

  // Audio message container
  audioMessageContainer: { minWidth: 200, maxWidth: 250 },

  // Audio loading state
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

  // Audio waveform placeholder
  waveformContainer: { flexDirection: "row", alignItems: "center", gap: 3 },
  waveBar: { width: 3, borderRadius: 2 },

  // Audio label
  audioLabel: {
    fontSize: 12,
    color: "#000",
    opacity: 0.7,
    fontFamily: "SofiaSans-Regular",
  },
  ownAudioLabel: { color: "#fff" },

  // Reaction badges
  reactionsRow: { flexDirection: "row", marginTop: 4, marginLeft: 8 },
  reactionsRowOwn: {
    justifyContent: "flex-end",
    marginLeft: 0,
    marginRight: 8,
  },
  reactionBadge: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    borderWidth: 0.5,
    borderColor: "#e5e5ea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, color: "#666", marginLeft: 2 },

  // Message footer - time and status
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  messageFooterOwn: { justifyContent: "flex-end" },
  timeText: {
    fontSize: 10,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },

  // Status icon
  statusIconContainer: {
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
