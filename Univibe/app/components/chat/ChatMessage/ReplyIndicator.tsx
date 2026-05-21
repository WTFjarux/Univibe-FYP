// app/components/chat/ChatMessage/ReplyIndicator.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { useAuth } from "../../../../lib/contexts/AuthContext";
import { getFullImageUrl } from "../../../../lib/utils/chatUtils";

interface ReplyIndicatorProps {
  replyToMessage: {
    _id: string;
    senderName: string;
    message: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaName?: string;
    duration?: number;
  } | null;
  onCancelReply: () => void;
}

const IMAGE_PREVIEW_SIZE = 56;
const BLUR_HASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

const getFileIcon = (name?: string): keyof typeof Ionicons.glyphMap => {
  if (!name) return "document-outline";
  const ext = name.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    pdf: "document-text",
    doc: "document-text",
    docx: "document-text",
    xls: "grid",
    xlsx: "grid",
    ppt: "easel",
    pptx: "easel",
    zip: "archive",
    rar: "archive",
    txt: "document",
    csv: "document",
  };
  return iconMap[ext || ""] || "document-outline";
};

const getFileColor = (name?: string): string => {
  if (!name) return "#8B5CF6";
  const ext = name.split(".").pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    pdf: "#FF3B30",
    doc: "#007AFF",
    docx: "#007AFF",
    xls: "#34C759",
    xlsx: "#34C759",
    ppt: "#FF9500",
    pptx: "#FF9500",
    zip: "#5856D6",
    rar: "#5856D6",
    txt: "#8E8E93",
  };
  return colorMap[ext || ""] || "#8B5CF6";
};

export default function ReplyIndicator({
  replyToMessage,
  onCancelReply,
}: ReplyIndicatorProps) {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (replyToMessage) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setImageLoaded(false);
      setImageError(false);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 350,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 60,
          useNativeDriver: true,
          damping: 20,
          stiffness: 350,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [replyToMessage]);

  if (!replyToMessage) return null;

  const isReplyingToSelf = replyToMessage.senderId === user?.id;
  const getReplyText = () =>
    isReplyingToSelf
      ? "Replying to yourself"
      : `Replying to ${replyToMessage.senderName}`;
  const getImageUrl = (): string | null => {
    const url = replyToMessage.thumbnailUrl || replyToMessage.mediaUrl;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return getFullImageUrl(url);
  };

  const renderMediaThumbnail = (
    iconName: keyof typeof Ionicons.glyphMap,
    label: string,
    isVideo?: boolean,
  ) => {
    const imageUrl = getImageUrl();
    return (
      <View style={styles.mediaPreview}>
        {imageUrl && !imageError ? (
          <View
            style={[
              styles.imagePreviewContainer,
              {
                backgroundColor: colors.skeleton,
                borderColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.08)",
              },
            ]}
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.imagePreview}
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
              placeholder={{ blurhash: BLUR_HASH }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              placeholderContentFit="cover"
              recyclingKey={imageUrl}
            />
            {!imageLoaded && (
              <View
                style={[
                  styles.imageLoadingContainer,
                  {
                    backgroundColor: isDark
                      ? "rgba(30,30,30,0.5)"
                      : "rgba(240,240,245,0.5)",
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
            <View style={styles.imageOverlay}>
              <Ionicons name={iconName} size={12} color="#fff" />
            </View>
            {isVideo && (
              <View style={styles.videoPlayBadge}>
                <Ionicons name="play" size={16} color="#fff" />
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.imageFallback,
              {
                backgroundColor: colors.skeleton,
                borderColor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <Ionicons name={iconName} size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.mediaTextContainer}>
          <Text
            style={[styles.messagePreview, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      </View>
    );
  };

  const renderFilePreview = () => {
    const fileName =
      replyToMessage.mediaName || replyToMessage.message || "File";
    const fileIcon = getFileIcon(fileName);
    const fileColor = getFileColor(fileName);
    return (
      <View style={styles.mediaPreview}>
        <View
          style={[
            styles.fileIconContainer,
            {
              backgroundColor: `${fileColor}18`,
              borderColor: isDark
                ? "rgba(255,255,255,0.08)"
                : "rgba(0,0,0,0.08)",
            },
          ]}
        >
          <Ionicons name={fileIcon} size={24} color={fileColor} />
        </View>
        <View style={styles.mediaTextContainer}>
          <Text
            style={[styles.messagePreview, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {fileName}
          </Text>
        </View>
      </View>
    );
  };

  const renderReplyContent = () => {
    const type = replyToMessage.type;
    if (type === "audio") {
      const duration = replyToMessage.duration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = `${minutes}:${seconds.toString().padStart(2, "0")}`;
      return (
        <View style={styles.voicePreview}>
          <View
            style={[
              styles.voiceIconWrap,
              {
                backgroundColor: isDark
                  ? "rgba(139, 92, 246, 0.2)"
                  : "rgba(139, 92, 246, 0.1)",
              },
            ]}
          >
            <Ionicons name="mic" size={16} color="#8B5CF6" />
          </View>
          <View style={styles.voiceWaveform}>
            {[10, 14, 8, 16, 10, 12, 8].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  { height: h, backgroundColor: "#8B5CF6" },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.voiceDuration, { color: colors.textSecondary }]}>
            Voice message • {durationText}
          </Text>
        </View>
      );
    }
    if (type === "image") return renderMediaThumbnail("camera", "Photo");
    if (type === "video")
      return renderMediaThumbnail("videocam", "Video", true);
    if (type === "file") return renderFilePreview();
    return (
      <Text
        style={[styles.messagePreview, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {replyToMessage.message}
      </Text>
    );
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          shadowColor: colors.shadow,
        },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
        <View style={styles.textContainer}>
          <Text style={[styles.senderName, { color: colors.primary }]}>
            {getReplyText()}
          </Text>
          {renderReplyContent()}
        </View>
        <TouchableOpacity onPress={onCancelReply} style={styles.cancelButton}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  content: { flexDirection: "row", alignItems: "center", width: "100%" },
  accentBar: {
    width: 4,
    minHeight: 56,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: "stretch",
  },
  textContainer: { flex: 1, flexShrink: 1 },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    fontFamily: "SofiaSans-Bold",
  },
  messagePreview: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    flexWrap: "wrap",
    flexShrink: 1,
  },
  cancelButton: { padding: 8, marginLeft: 12, alignSelf: "flex-start" },
  voicePreview: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  voiceWaveform: { flexDirection: "row", alignItems: "center", gap: 3 },
  waveBar: { width: 3, borderRadius: 1.5 },
  voiceDuration: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  mediaPreview: { flexDirection: "row", alignItems: "center", gap: 10 },
  imagePreviewContainer: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
  },
  imagePreview: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 10,
  },
  imageLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  imageOverlay: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 6,
    padding: 3,
  },
  videoPlayBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  imageFallback: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  fileIconContainer: {
    width: IMAGE_PREVIEW_SIZE,
    height: IMAGE_PREVIEW_SIZE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  mediaTextContainer: { flex: 1, justifyContent: "center", gap: 2 },
});
