// app/components/chat/ChatMessage.tsx (FULLY UPDATED)

import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import ChatMessageOptionsModal from "./ChatMessageOptionsModal";

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read" | "sending";
  type?: "text" | "image" | "audio" | "file";
  mediaUrl?: string;
  duration?: number;
  reactions?: Array<{ userId: string; reaction: string; createdAt: string }>;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
  };
}

interface ChatMessageProps {
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
  onScrollToMessage?: (messageId: string) => void;
}

export default function ChatMessage({
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
  onScrollToMessage,
}: ChatMessageProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const avatarUrl = message.senderAvatar
    ? getFullImageUrl(message.senderAvatar)
    : "";

  // Get current user's reaction if any
  const currentUserReaction = message.reactions?.find(
    (r) => r.userId === currentUserId,
  )?.reaction;

  // Group reactions for display
  const reactionGroups = message.reactions?.reduce(
    (acc, r) => {
      acc[r.reaction] = (acc[r.reaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const handleLongPress = (event: any) => {
    // Trigger haptic feedback on long press
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { pageX, pageY } = event.nativeEvent;
    setOptionsPosition({ x: pageX - 100, y: pageY - 80 });
    setShowOptions(true);
  };

  const handleCopy = async () => {
    // Haptic feedback for copy action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.message);
    setShowOptions(false);
  };

  const handleReply = () => {
    // Haptic feedback for reply action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onReply) onReply(message);
    setShowOptions(false);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            if (onDelete) onDelete(message._id);
            setShowOptions(false);
          },
        },
      ],
    );
  };

  const handleForward = async () => {
    // Haptic feedback for forward action
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onForward) {
      onForward(message);
    } else {
      await Share.share({ message: message.message });
    }
    setShowOptions(false);
  };

  const handleReaction = (reaction: string, shouldRemove?: boolean) => {
    // Different haptic feedback for add vs remove
    if (shouldRemove) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedReaction(reaction);
    setTimeout(() => setSelectedReaction(null), 200);
    if (onReaction) onReaction(message._id, reaction, shouldRemove);
    setShowOptions(false);
  };

  const handleReplyPreviewPress = () => {
    if (message.replyTo && onScrollToMessage) {
      // Haptic feedback when tapping reply preview
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onScrollToMessage(message.replyTo.messageId);
    }
  };

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;

    return (
      <TouchableOpacity
        style={styles.replyPreviewContainer}
        onPress={handleReplyPreviewPress}
        activeOpacity={0.7}
      >
        <View style={styles.replyPreviewBar} />
        <View style={styles.replyPreviewContent}>
          <Text style={styles.replyPreviewSender}>
            {message.replyTo.senderName}
          </Text>
          <Text style={styles.replyPreviewText} numberOfLines={1}>
            {message.replyTo.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageContent = () => {
    if (message.type === "image" && message.mediaUrl) {
      return (
        <Image
          source={{ uri: getFullImageUrl(message.mediaUrl) }}
          style={styles.messageImage}
          resizeMode="cover"
        />
      );
    } else if (message.type === "audio") {
      // Show loading state for sending audio (when mediaUrl is undefined or status is sending)
      if (message.status === "sending" || !message.mediaUrl) {
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
                        : "#007bff",
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

      // Normal audio player for loaded messages
      return (
        <View style={styles.audioMessageContainer}>
          <AudioPlayer
            audioUrl={message.mediaUrl}
            duration={message.duration || 0}
            isOwnMessage={isOwnMessage}
            messageId={message._id}
            onPlayed={onAudioPlayed}
          />
        </View>
      );
    } else {
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
    }
  };

  const getMessageStatusIcon = () => {
    if (!isOwnMessage) return null;
    switch (message.status) {
      case "sending":
        return <ActivityIndicator size={10} color="#8E8E93" />;
      case "sent":
        return <Ionicons name="checkmark" size={14} color="#8E8E93" />;
      case "delivered":
        return <Ionicons name="checkmark-done" size={14} color="#8E8E93" />;
      case "read":
        return <Ionicons name="checkmark-done" size={14} color="#34C759" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.messageWrapper,
          pressed && styles.messagePressed,
        ]}
      >
        <View
          style={[
            styles.messageRow,
            isOwnMessage ? styles.ownMessageRow : styles.otherMessageRow,
          ]}
        >
          {/* Avatar */}
          {!isOwnMessage && showAvatar && (
            <View style={styles.avatarContainer}>
              <Image
                source={avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR}
                style={styles.avatar}
              />
            </View>
          )}
          {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}
          {isOwnMessage && <View style={styles.avatarSpacer} />}

          {/* Message Content */}
          <View style={styles.messageContent}>
            {/* Reply Preview - Now clickable */}
            {renderReplyPreview()}

            {/* Message Bubble */}
            <View
              style={[
                styles.bubble,
                isOwnMessage ? styles.ownBubble : styles.otherBubble,
              ]}
            >
              {renderMessageContent()}
            </View>

            {/* Reactions Row */}
            {reactionGroups && Object.keys(reactionGroups).length > 0 && (
              <View style={styles.reactionsRow}>
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

            {/* Time and Status */}
            <View style={styles.messageFooter}>
              <Text style={styles.timeText}>
                {formatTime(message.createdAt)}
              </Text>
              {getMessageStatusIcon()}
            </View>
          </View>
        </View>
      </Pressable>

      {/* Options Modal */}
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
          replyTo: message.replyTo,
        }}
        getFullImageUrl={getFullImageUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  messageWrapper: {
    marginVertical: 4,
  },
  messagePressed: {
    opacity: 0.7,
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
  avatarContainer: {
    marginRight: 8,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  avatarSpacer: {
    width: 40,
  },
  messageContent: {
    maxWidth: "75%",
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
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
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
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
  replyPreviewContainer: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  replyPreviewBar: {
    width: 3,
    backgroundColor: "#8b5cf6",
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 11,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  reactionsRow: {
    flexDirection: "row",
    marginTop: 4,
    marginLeft: 8,
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
  reactionEmoji: {
    fontSize: 12,
  },
  reactionCount: {
    fontSize: 10,
    color: "#666",
    marginLeft: 2,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
});
