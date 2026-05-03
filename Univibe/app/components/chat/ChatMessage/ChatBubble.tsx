// app/components/chat/ChatMessage/ChatBubble.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Post } from "../../../../lib/services/postService";
import AudioPlayer from "./AudioPlayer";
import AttachmentMessage from "./AttachmentMessage";
import ChatImageViewer from "./ChatImageViewer";
import ChatVideoPlayer from "./ChatVideoPlayer";
import ChatMessageOptionsModal from "./ChatMessageOptionsModal";
import ReplyPreview from "./ReplyPreview";
import ChatFileViewer from "./ChatFileViewer";
import PostCard from "../../Feed/Post/PostCard";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read" | "sending";
  type?: "text" | "image" | "audio" | "video" | "file" | "location" | "post";
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
    thumbnailUrl?: string;
    duration?: number;
  };
  isForwarded?: boolean;
  originalMessageId?: string;
  originalSenderId?: string;
  originalSenderName?: string;
  forwardedAt?: string;
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

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

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
  const router = useRouter();

  const [showOptions, setShowOptions] = useState(false);
  const [optionsPosition, setOptionsPosition] = useState({ x: 0, y: 0 });
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [videoPlayerUri, setVideoPlayerUri] = useState<string | null>(null);
  const [videoPlayerVisible, setVideoPlayerVisible] = useState(false);

  const isHighlighted = highlightedMessageId === message._id;
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const [fileViewerVisible, setFileViewerVisible] = useState(false);
  const [fileViewerUrl, setFileViewerUrl] = useState("");
  const [fileViewerName, setFileViewerName] = useState("");
  const [fileViewerSize, setFileViewerSize] = useState<number | undefined>(
    undefined,
  );

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

  const isMediaType = ["image", "video", "file", "location"].includes(
    message.type || "",
  );
  const isPostType = message.type === "post" && message.sharedPost;
  const isForwarded = message.isForwarded === true;

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

  const isMessageRead = (): boolean => {
    if (!isOwnMessage || !message.readBy || message.readBy.length === 0)
      return false;
    const senderId = getSenderId();
    return message.readBy.some((r: any) => {
      const readUserId = typeof r === "string" ? r : r.user || r.userId;
      return readUserId?.toString() !== senderId?.toString();
    });
  };

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

  const getMessageStatusIcon = () => {
    if (!isOwnMessage) return null;
    if (message.status === "sending")
      return <ActivityIndicator size={10} color="#8E8E93" />;
    if (isMessageRead() || message.status === "read")
      return (
        <View style={styles.statusIconContainer}>
          <Ionicons name="checkmark-done" size={14} color="#34C759" />
        </View>
      );
    if (isMessageDelivered() || message.status === "delivered")
      return (
        <View style={styles.statusIconContainer}>
          <Ionicons name="checkmark-done" size={14} color="#8E8E93" />
        </View>
      );
    return (
      <View style={styles.statusIconContainer}>
        <Ionicons name="checkmark" size={14} color="#8E8E93" />
      </View>
    );
  };

  const getStatusText = (): string => {
    if (!isOwnMessage) return "";
    if (message.status === "sending") return "Sending...";
    if (isMessageRead() || message.status === "read") return "Read";
    if (isMessageDelivered() || message.status === "delivered")
      return "Delivered";
    return "Sent";
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

  const handleImagePress = (url: string) => {
    setViewerImages([url]);
    setViewerIndex(0);
    setImageViewerVisible(true);
  };

  const handleVideoPress = (url: string) => {
    setVideoPlayerUri(url);
    setVideoPlayerVisible(true);
  };

  const handleSharedPostPress = useCallback(() => {
    if (message.sharedPost?.postId) {
      router.push({
        pathname: "/post/[id]",
        params: { id: message.sharedPost.postId },
      });
    }
  }, [message.sharedPost?.postId, router]);

  const getForwardedLabel = (): string => {
    if (!isForwarded) return "";
    if (getSenderId() === currentUserId) return "You forwarded";
    return "Forwarded";
  };

  const renderForwardedLabel = () => {
    if (!isForwarded) return null;
    return (
      <View
        style={[
          styles.forwardedLabelContainer,
          isOwnMessage ? styles.forwardedLabelOwn : styles.forwardedLabelOther,
        ]}
      >
        <Ionicons name="arrow-redo" size={11} color="#8E8E93" />
        <Text style={styles.forwardedLabelText} numberOfLines={1}>
          {getForwardedLabel()}
        </Text>
      </View>
    );
  };

  const buildPostFromSharedData = (): Post | null => {
    if (!message.sharedPost || !message.sharedPost.postId) return null;
    return {
      _id: message.sharedPost.postId,
      user: {
        _id: message.sharedPost.postAuthorId || "",
        name: message.sharedPost.postAuthorName || "Unknown",
        username: message.sharedPost.isAnonymous
          ? "anonymous"
          : message.sharedPost.postAuthorUsername || "user",
        email: null,
        profilePicture: message.sharedPost.postAuthorAvatar || "",
        verified: false,
      },
      content: message.sharedPost.postContent || "",
      images: message.sharedPost.postImage
        ? [
            {
              filename: "",
              url: message.sharedPost.postImage,
              path: "",
              mimetype: "image/jpeg",
              size: 0,
            },
          ]
        : [],
      tags: [],
      campus: "",
      visibility: "campus" as const,
      isAnonymous: message.sharedPost.isAnonymous || false,
      isEdited: false,
      editedAt: null,
      createdAt: message.sharedPost.postCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isLiked: false,
      likeCount: 0,
      commentCount: 0,
    };
  };

  const renderMessageContent = () => {
    if (isPostType) {
      const postData = buildPostFromSharedData();
      if (!postData) return null;
      const hasMessage = message.message && message.message.trim().length > 0;

      return (
        <View style={styles.postMessageContainer}>
          {/* ✅ Long press on the entire shared post area */}
          <Pressable
            onPress={handleSharedPostPress}
            onLongPress={handleLongPress}
            delayLongPress={300}
            style={{ width: "100%" }}
          >
            {/* ✅ pointerEvents="none" prevents PostCard from stealing touches */}
            <View pointerEvents="none">
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
            </View>
          </Pressable>
          {hasMessage && (
            <Pressable
              onPress={handleSharedPostPress}
              onLongPress={handleLongPress}
              delayLongPress={300}
            >
              <View
                style={[
                  styles.messageBubble,
                  isOwnMessage
                    ? styles.ownMessageBubble
                    : styles.otherMessageBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isOwnMessage
                      ? styles.ownMessageText
                      : styles.otherMessageText,
                  ]}
                >
                  {message.message}
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      );
    }

    if (isMediaType) {
      return (
        <AttachmentMessage
          type={
            (message.type as "image" | "video" | "file" | "location") || "file"
          }
          mediaUrl={
            message.mediaUrl ? getFullImageUrl(message.mediaUrl) : undefined
          }
          thumbnailUrl={
            message.thumbnailUrl
              ? getFullImageUrl(message.thumbnailUrl)
              : undefined
          }
          mediaName={message.mediaName}
          mediaSize={message.mediaSize}
          mediaDuration={message.duration}
          locationData={message.locationData}
          isOwnMessage={isOwnMessage}
          onImagePress={(url) => handleImagePress(url)}
          onVideoPress={(url) => handleVideoPress(url)}
          onFilePress={(url, name) => {
            setFileViewerUrl(url);
            setFileViewerName(name);
            setFileViewerSize(message.mediaSize);
            setFileViewerVisible(true);
          }}
          onLocationPress={(lat, lng) =>
            console.log("Open location:", lat, lng)
          }
          onLongPress={handleLongPress}
        />
      );
    }

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
                      ? "rgba(255,255,255,0.5)"
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

  const getReplyDataForModal = () => {
    if (!message.replyTo) return undefined;
    return {
      messageId: message.replyTo.messageId,
      message: message.replyTo.message,
      senderName: message.replyTo.senderName,
      senderId: message.replyTo.senderId,
      type: message.replyTo.type,
      mediaUrl: message.replyTo.mediaUrl,
      thumbnailUrl: message.replyTo.thumbnailUrl,
      duration: message.replyTo.duration,
    };
  };

  return (
    <>
      <View style={styles.messageWrapper}>
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
                  thumbnailUrl: message.replyTo.thumbnailUrl,
                  duration: message.replyTo.duration,
                }}
                isOwnMessage={isOwnMessage}
                currentUserId={currentUserId}
                onScrollToMessage={onScrollToMessage}
              />
            )}
            {renderForwardedLabel()}
            <Pressable
              onLongPress={handleLongPress}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.bubble,
                !isMediaType && !isPostType && styles.bubbleAutoWidth,
                !isMediaType &&
                  !isPostType &&
                  (isOwnMessage ? styles.ownBubble : styles.otherBubble),
                (isMediaType || isPostType) && styles.mediaBubble,
                isOwnMessage ? styles.bubbleAlignRight : styles.bubbleAlignLeft,
                pressed && styles.bubblePressed,
              ]}
            >
              {renderMessageContent()}
            </Pressable>
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
        message={message}
        getFullImageUrl={getFullImageUrl}
        formatTime={formatTime}
        currentUserId={currentUserId}
        DEFAULT_AVATAR={DEFAULT_AVATAR}
      />
      <ChatImageViewer
        visible={imageViewerVisible}
        images={viewerImages}
        initialIndex={viewerIndex}
        onClose={() => setImageViewerVisible(false)}
      />
      <ChatVideoPlayer
        visible={videoPlayerVisible}
        uri={videoPlayerUri || ""}
        onClose={() => {
          setVideoPlayerVisible(false);
          setVideoPlayerUri(null);
        }}
      />
      <ChatFileViewer
        visible={fileViewerVisible}
        fileUrl={fileViewerUrl}
        fileName={fileViewerName}
        fileSize={fileViewerSize}
        onClose={() => setFileViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  messageWrapper: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: "visible",
    position: "relative",
  },
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
  bubblePressed: { opacity: 0.9 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    zIndex: 1,
    padding: 4,
    width: "100%",
  },
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
  messageContent: { maxWidth: "75%", flexShrink: 1 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleAutoWidth: { alignSelf: "flex-start" },
  bubbleAlignRight: { alignSelf: "flex-end" },
  bubbleAlignLeft: { alignSelf: "flex-start" },
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
  messageBubble: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    alignSelf: "flex-start",
  },
  ownMessageBubble: {
    backgroundColor: "#8b5cf6",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#E5E5EA",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  postMessageContainer: { width: 260, maxWidth: "100%" },
  forwardedLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    paddingHorizontal: 12,
    gap: 4,
  },
  forwardedLabelOwn: { alignSelf: "flex-end" },
  forwardedLabelOther: { alignSelf: "flex-start" },
  forwardedLabelText: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    fontStyle: "italic",
    color: "#8E8E93",
    flexShrink: 1,
  },
  audioMessageContainer: { minWidth: 150, maxWidth: 250 },
  audioLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 200,
    maxWidth: 280,
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
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  messageFooterOwn: { justifyContent: "flex-end" },
  timeText: { fontSize: 10, color: "#8E8E93", fontFamily: "SofiaSans-Regular" },
  statusIconContainer: {
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },
});
