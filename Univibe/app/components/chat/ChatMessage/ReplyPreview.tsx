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
    thumbnailUrl?: string;
    duration?: number;
    videoDuration?: number;
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

  const detectReplyType = (): string => {
    if (replyTo.type === "audio") return "audio";
    if (replyTo.type === "image") return "image";
    if (replyTo.type === "video") return "video";

    const msgText = replyTo.message || "";
    if (msgText === "Voice message" || msgText.includes("Voice message"))
      return "audio";
    if (msgText === "Photo" || msgText.includes("Photo")) return "image";
    if (msgText === "Video" || msgText.includes("Video")) return "video";

    if (replyTo.mediaUrl) {
      if (replyTo.mediaUrl.includes("audio")) return "audio";
      if (replyTo.mediaUrl.includes("image")) return "image";
      if (replyTo.mediaUrl.includes("video")) return "video";
    }

    return "text";
  };

  const getImageUrl = (): string | null => {
    const url = replyTo.thumbnailUrl || replyTo.mediaUrl;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return getFullImageUrl(url);
  };

  const getReplyPreviewText = (): string => {
    const repliedSenderName = replyTo.senderName;
    const isOriginalFromCurrentUser =
      (replyTo.senderId &&
        currentUserId &&
        String(replyTo.senderId) === String(currentUserId)) ||
      repliedSenderName === "You";

    if (isOwnMessage && isOriginalFromCurrentUser)
      return "You replied to yourself";
    if (isOwnMessage && !isOriginalFromCurrentUser)
      return `You replied to ${repliedSenderName}`;
    if (!isOwnMessage && !isOriginalFromCurrentUser)
      return `${repliedSenderName} replied to themselves`;
    return `${repliedSenderName} replied to you`;
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderMediaThumbnail = (
    iconName: keyof typeof Ionicons.glyphMap,
    label: string,
    isVideo?: boolean,
  ) => {
    const imageUrl = getImageUrl();

    return (
      <View style={styles.mediaPreviewContainer}>
        {imageUrl && !imageError ? (
          <View style={styles.mediaThumbnailWrapper}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.mediaThumbnail}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: BLUR_HASH }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              recyclingKey={imageUrl}
            />
            {!imageLoaded && (
              <View style={styles.mediaLoadingOverlay}>
                <ActivityIndicator size="small" color="#8B5CF6" />
              </View>
            )}
            <View style={styles.mediaIconOverlay}>
              <Ionicons name={iconName} size={8} color="#fff" />
            </View>
            {isVideo && (
              <View style={styles.videoPlayOverlay}>
                <Ionicons name="play" size={14} color="#fff" />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.mediaFallback}>
            <Ionicons name={iconName} size={16} color="#8E8E93" />
          </View>
        )}
        <View style={styles.mediaTextContainer}>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {label}
          </Text>
          {isVideo && replyTo.videoDuration ? (
            <Text style={styles.durationText} numberOfLines={1}>
              {formatDuration(replyTo.videoDuration)}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderReplyContent = () => {
    const replyType = detectReplyType();

    if (replyType === "audio") {
      let duration = replyTo.duration || 0;
      if (duration === 0 && replyTo.message) {
        const match = replyTo.message.match(/\((\d+):(\d+)\)/);
        if (match) duration = parseInt(match[1]) * 60 + parseInt(match[2]);
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
      return renderMediaThumbnail("camera", "Photo");
    }

    if (replyType === "video") {
      return renderMediaThumbnail("videocam", "Video", true);
    }

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
  // Voice
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
  // Shared media preview
  mediaPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  mediaThumbnailWrapper: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F0F0F5",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
  },
  mediaThumbnail: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
  },
  mediaLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(240, 240, 245, 0.5)",
  },
  mediaIconOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 3,
    padding: 1.5,
  },
  videoPlayOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  mediaFallback: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 6,
    backgroundColor: "#F0F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.05)",
  },
  mediaTextContainer: {
    flexShrink: 1,
  },
  durationText: {
    fontSize: 10,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
    marginTop: 1,
  },
});
