// app/components/chat/ChatMessage/ReplyPreview.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

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

export default function ReplyPreview({
  replyTo,
  isOwnMessage,
  currentUserId,
  onScrollToMessage,
}: ReplyPreviewProps) {
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
            <Ionicons name="mic" size={14} color="#8B5CF6" />
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
      return (
        <View style={styles.imagePreview}>
          <Ionicons name="image-outline" size={14} color="#8E8E93" />
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
    paddingHorizontal: 8,
    paddingTop: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
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
  imagePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
});
