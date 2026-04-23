// app/components/chat/ChatMessage/ChatBubble.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  Share,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import AudioPlayer from "./AudioPlayer";
import AttachmentMessage from "./AttachmentMessage";
import ChatImageViewer from "./ChatImageViewer";
import ChatMessageOptionsModal from "./ChatMessageOptionsModal";
import ReplyPreview from "./ReplyPreview";

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
  mediaSize?: number;
  mediaName?: string;
  mediaMimeType?: string;
  duration?: number;
  locationData?: { latitude: number; longitude: number; locationName?: string };
  reactions?: Array<{ userId: string; reaction: string; createdAt: string }>;
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
  onScrollToMessage?: (messageId: string) => void;
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  groupId?: string;
}

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
  onScrollToMessage,
}: ChatBubbleProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // 🔴 Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState("");

  const isMediaType = ["image", "video", "file", "location"].includes(
    message.type || "",
  );

  const getAvatarSource = () => {
    if (avatarError) return DEFAULT_AVATAR;
    if (message.senderAvatar) {
      const fullUrl = getFullImageUrl(message.senderAvatar);
      if (fullUrl && fullUrl.length > 0) return { uri: fullUrl };
    }
    return DEFAULT_AVATAR;
  };

  const currentUserReaction = message.reactions?.find(
    (r) => r.userId === currentUserId,
  )?.reaction;

  const reactionGroups = message.reactions?.reduce(
    (acc, r) => {
      acc[r.reaction] = (acc[r.reaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const getSenderId = (): string => {
    return typeof message.sender === "string"
      ? message.sender
      : message.sender?._id || "";
  };

  const handleLongPress = (event: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { pageX, pageY } = event.nativeEvent;
    setOptionsPosition({ x: pageX - 100, y: pageY - 80 });
    setShowOptions(true);
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(message.message);
    setShowOptions(false);
  };

  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onReply) onReply(message);
    setShowOptions(false);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowOptions(false);
    if (onDelete) onDelete(message._id);
  };

  const handleForward = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onForward) onForward(message);
    else await Share.share({ message: message.message });
    setShowOptions(false);
  };

  const handleReaction = (reaction: string, shouldRemove?: boolean) => {
    if (shouldRemove)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReaction(shouldRemove ? null : reaction);
    if (onReaction) onReaction(message._id, reaction, shouldRemove);
    setShowOptions(false);
  };

  // 🔴 Handle image press - open full screen viewer
  const handleImagePress = (url: string) => {
    setViewerImageUrl(url);
    setImageViewerVisible(true);
  };

  const renderMessageContent = () => {
    if (isMediaType) {
      return (
        <AttachmentMessage
          type={
            (message.type as "image" | "video" | "file" | "location") || "file"
          }
          mediaUrl={
            message.mediaUrl ? getFullImageUrl(message.mediaUrl) : undefined
          }
          mediaName={message.mediaName}
          mediaSize={message.mediaSize}
          locationData={message.locationData}
          isOwnMessage={isOwnMessage}
          onImagePress={(url) => handleImagePress(url)}
          onFilePress={(url, name) => console.log("Open file:", url, name)}
          onLocationPress={(lat, lng) =>
            console.log("Open location:", lat, lng)
          }
        />
      );
    }

    if (message.type === "audio") {
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
            onPlayed={onAudioPlayed}
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
          {!isOwnMessage && showAvatar && (
            <View style={styles.avatarContainer}>
              <Image
                source={getAvatarSource()}
                style={styles.avatar}
                onError={() => setAvatarError(true)}
              />
            </View>
          )}
          {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}
          {isOwnMessage && <View style={styles.avatarSpacer} />}

          <View style={styles.messageContent}>
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

            <View
              style={[
                styles.bubble,
                (!isMediaType || message.type === "audio") &&
                  styles.bubbleAutoWidth,
                (!isMediaType || message.type === "audio") &&
                  (isOwnMessage ? styles.ownBubble : styles.otherBubble),
                (!isMediaType || message.type === "audio") &&
                  isOwnMessage &&
                  styles.ownBubbleAlignment,
                isMediaType && styles.mediaBubble,
              ]}
            >
              {renderMessageContent()}
            </View>

            {reactionGroups && Object.keys(reactionGroups).length > 0 && (
              <View
                style={[
                  styles.reactionsRow,
                  isOwnMessage && styles.ownReactionsRow,
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

            {showTime && (
              <View
                style={[
                  styles.messageFooter,
                  isOwnMessage && styles.ownMessageFooter,
                ]}
              >
                <Text style={styles.timeText}>
                  {formatTime(message.createdAt)}
                </Text>
                {getMessageStatusIcon()}
              </View>
            )}
          </View>
        </View>
      </Pressable>

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

      {/* 🔴 Full screen image viewer */}
      <ChatImageViewer
        visible={imageViewerVisible}
        imageUrl={viewerImageUrl}
        onClose={() => setImageViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  messageWrapper: { marginVertical: 4 },
  messagePressed: { opacity: 0.7 },
  messageRow: { flexDirection: "row", alignItems: "flex-end" },
  ownMessageRow: { justifyContent: "flex-end" },
  otherMessageRow: { justifyContent: "flex-start" },
  avatarContainer: { marginRight: 8, marginBottom: 4 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  avatarSpacer: { width: 40 },
  messageContent: { maxWidth: "75%" },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleAutoWidth: { alignSelf: "flex-start" },
  ownBubbleAlignment: { alignSelf: "flex-end" },
  ownBubble: { backgroundColor: "#8b5cf6", borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: "#E5E5EA", borderBottomLeftRadius: 4 },
  mediaBubble: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "SofiaSans-Regular",
  },
  ownMessageText: { color: "#fff" },
  otherMessageText: { color: "#000" },
  audioMessageContainer: { minWidth: 200, maxWidth: 250 },
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
  waveformContainer: { flexDirection: "row", alignItems: "center", gap: 3 },
  waveBar: { width: 3, borderRadius: 2 },
  audioLabel: {
    fontSize: 12,
    color: "#000",
    opacity: 0.7,
    fontFamily: "SofiaSans-Regular",
  },
  ownAudioLabel: { color: "#fff" },
  reactionsRow: { flexDirection: "row", marginTop: 4, marginLeft: 8 },
  ownReactionsRow: {
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
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  ownMessageFooter: { justifyContent: "flex-end" },
  timeText: { fontSize: 10, color: "#8E8E93", fontFamily: "SofiaSans-Regular" },
});
