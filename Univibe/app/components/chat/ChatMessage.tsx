// app/components/chat/ChatMessage.tsx
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
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
  status?: "sent" | "delivered" | "read";
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
  onReaction?: (messageId: string, reaction: string) => void;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (message: Message) => void;
  currentUserId?: string;
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
}: ChatMessageProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const avatarUrl = message.senderAvatar
    ? getFullImageUrl(message.senderAvatar)
    : "";

  // Group reactions for display
  const reactionGroups = message.reactions?.reduce(
    (acc, r) => {
      acc[r.reaction] = (acc[r.reaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const handleLongPress = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setOptionsPosition({ x: pageX - 100, y: pageY - 80 });
    setShowOptions(true);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.message);
    setShowOptions(false);
  };

  const handleReply = () => {
    if (onReply) onReply(message);
    setShowOptions(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            if (onDelete) onDelete(message._id);
            setShowOptions(false);
          },
        },
      ],
    );
  };

  const handleForward = async () => {
    if (onForward) {
      onForward(message);
    } else {
      await Share.share({ message: message.message });
    }
    setShowOptions(false);
  };

  const handleReaction = (reaction: string) => {
    setSelectedReaction(reaction);
    setTimeout(() => setSelectedReaction(null), 200);
    if (onReaction) onReaction(message._id, reaction);
    setShowOptions(false);
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
            {/* Reply Preview */}
            {message.replyTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyPreviewBar} />
                <View style={styles.replyPreviewContent}>
                  <Text style={styles.replyPreviewSender}>
                    {message.replyTo.senderName}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {message.replyTo.message}
                  </Text>
                </View>
              </View>
            )}

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
        selectedReaction={selectedReaction}
        message={{
          _id: message._id,
          message: message.message,
          type: message.type,
          mediaUrl: message.mediaUrl,
          senderName: message.senderName,
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
    backgroundColor: "#007AFF",
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
  replyPreview: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  replyPreviewBar: {
    width: 3,
    backgroundColor: "#007AFF",
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 11,
    fontWeight: "600",
    color: "#007AFF",
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
