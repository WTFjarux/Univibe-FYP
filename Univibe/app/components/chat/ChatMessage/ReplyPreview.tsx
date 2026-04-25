// app/components/chat/ChatMessage/ReplyPreview.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getFullImageUrl } from "../../../../lib/utils/chatUtils";

interface ReplyPreviewProps {
  replyTo: {
    messageId: string;
    message: string;
    senderName: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
    duration?: number;
  };
  isOwnMessage: boolean;
  currentUserId?: string;
  onScrollToMessage?: (messageId: string) => void;
}

const IMAGE_PREVIEW_SIZE = 46;
const BLUR_HASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export default function ReplyPreview({
  replyTo,
  isOwnMessage,
  currentUserId,
  onScrollToMessage,
}: ReplyPreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Check if this is a valid reply
  const isValidReply = (): boolean => {
    return !!(
      replyTo &&
      replyTo.messageId &&
      replyTo.senderName &&
      replyTo.senderName !== ""
    );
  };

  if (!isValidReply()) return null;

  const handlePress = () => {
    if (replyTo.messageId && onScrollToMessage) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onScrollToMessage(replyTo.messageId);
    }
  };

  // Detect reply type from message content
  const detectReplyType = (): string => {
    if (replyTo.type === "audio") return "audio";
    if (replyTo.type === "image") return "image";

    const msgText = replyTo.message || "";
    if (
      msgText === "🎤 Voice message" ||
      msgText.includes("Voice message") ||
      msgText.includes("voice message")
    ) {
      return "audio";
    }

    if (replyTo.mediaUrl && replyTo.mediaUrl.includes("audio")) {
      return "audio";
    }

    if (msgText === "📷 Photo" || msgText.includes("Photo")) {
      return "image";
    }
    if (replyTo.mediaUrl && replyTo.mediaUrl.includes("image")) {
      return "image";
    }

    return "text";
  };

  // Get the image URL for preview
  const getImageUrl = (): string | null => {
    if (!replyTo.mediaUrl) return null;

    // If it's already a full URL, return it
    if (replyTo.mediaUrl.startsWith("http")) {
      return replyTo.mediaUrl;
    }

    // Otherwise, use getFullImageUrl to construct the full URL
    return getFullImageUrl(replyTo.mediaUrl);
  };

  const getReplyPreviewText = (): string => {
    const repliedSenderName = replyTo.senderName;

    // Check if original message is from current user
    const isOriginalFromCurrentUser =
      (replyTo.senderId &&
        currentUserId &&
        String(replyTo.senderId) === String(currentUserId)) ||
      repliedSenderName === "You";

    // Case 1: Current user replying to their own message
    if (isOwnMessage && isOriginalFromCurrentUser) {
      return "You replied to yourself";
    }

    // Case 2: Current user replying to other person's message
    if (isOwnMessage && !isOriginalFromCurrentUser) {
      return `You replied to ${repliedSenderName}`;
    }

    // Case 3: Other person replying to their own message
    if (!isOwnMessage && !isOriginalFromCurrentUser) {
      return `${repliedSenderName} replied to themselves`;
    }

    // Case 4: Other person replying to current user's message
    return `${repliedSenderName} replied to you`;
  };

  const renderReplyContent = () => {
    const replyType = detectReplyType();

    if (replyType === "audio") {
      let duration = replyTo.duration || 0;

      if (duration === 0 && replyTo.message) {
        const match = replyTo.message.match(/\((\d+):(\d+)\)/);
        if (match) {
          duration = parseInt(match[1]) * 60 + parseInt(match[2]);
        }
      }

      if (duration === 0) duration = 15;

      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      return (
        <View style={styles.voicePreview}>
          <View style={styles.voiceIconWrap}>
            <Ionicons name="mic" size={12} color="#8B5CF6" />
          </View>
          <View style={styles.voiceWaveform}>
            {[8, 14, 10, 18, 12, 16, 10, 14, 8].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { height: h, backgroundColor: "#8B5CF6" },
                ]}
              />
            ))}
          </View>
          <Text style={styles.voiceDuration} numberOfLines={1}>
            Voice message • {durationText}
          </Text>
        </View>
      );
    }

    if (replyType === "image") {
      const imageUrl = getImageUrl();

      return (
        <View style={styles.imagePreviewContainer}>
          {imageUrl && !imageError ? (
            <View style={styles.imageThumbnailWrapper}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.imageThumbnail}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: BLUR_HASH }}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                recyclingKey={imageUrl}
              />
              {!imageLoaded && (
                <View style={styles.imageLoadingOverlay}>
                  <ActivityIndicator size="small" color="#8B5CF6" />
                </View>
              )}
              <View style={styles.imageIconOverlay}>
                <Ionicons name="camera" size={8} color="#fff" />
              </View>
            </View>
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={16} color="#8E8E93" />
            </View>
          )}
          <Text style={styles.messagePreview} numberOfLines={1}>
            Photo
          </Text>
        </View>
      );
    }

    // Text message
    return (
      <Text style={styles.messagePreview} numberOfLines={1}>
        {replyTo.message}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={[
        styles.replyPreviewWrapper,
        isOwnMessage && styles.ownReplyPreviewWrapper,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.replyPreviewContainer}>
        <View style={styles.accentBar} />
        <View style={styles.contentContainer}>
          <Text style={styles.senderName} numberOfLines={1}>
            {getReplyPreviewText()}
          </Text>
          {renderReplyContent()}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  replyPreviewWrapper: {
    marginBottom: 6,
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  ownReplyPreviewWrapper: {
    alignSelf: "flex-end",
  },
  replyPreviewContainer: {
    flexDirection: "row",
    paddingBottom: 6,
    paddingHorizontal: 15,
    paddingTop: 6,
    backgroundColor: "rgba(124, 58, 237, 0.06)",
    borderRadius: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
    alignSelf: "flex-start",
  },
  accentBar: {
    width: 3,
    backgroundColor: "#8B5CF6",
    borderRadius: 2,
    marginRight: 8,
    alignSelf: "stretch",
  },
  contentContainer: {
    flexShrink: 1,
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8B5CF6",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
    textAlign: "left",
  },
  messagePreview: {
    fontSize: 11,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 14,
    textAlign: "left",
  },
  // Voice styles
  voicePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  voiceIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceWaveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  waveBar: {
    width: 2.5,
    borderRadius: 1.25,
  },
  voiceDuration: {
    fontSize: 10,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
    marginLeft: 2,
  },
  // Image preview styles
  imagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  imageThumbnailWrapper: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F0F0F5",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  imageThumbnail: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(240, 240, 245, 0.5)",
  },
  imageIconOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 3,
    padding: 1.5,
  },
  imageFallback: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
    backgroundColor: "#F0F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
});
