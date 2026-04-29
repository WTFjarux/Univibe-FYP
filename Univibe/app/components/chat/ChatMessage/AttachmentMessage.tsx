// app/components/chat/ChatMessage/AttachmentMessage.tsx

import React, { useState, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// DIMENSIONS
// ============================================

const IMAGE_WIDTH = SCREEN_WIDTH * 0.55;
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.25;

const DEFAULT_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const PHOTO_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface AttachmentMessageProps {
  type: "image" | "video" | "file" | "location";
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  mediaMimeType?: string;
  mediaDuration?: number;
  locationData?: {
    latitude: number;
    longitude: number;
    locationName?: string;
  };
  isOwnMessage: boolean;
  onImagePress?: (url: string) => void;
  onVideoPress?: (url: string) => void;
  onFilePress?: (url: string, name: string) => void;
  onLocationPress?: (latitude: number, longitude: number) => void;
  onLongPress?: (event: any) => void;
}

// ============================================
// HELPERS
// ============================================

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds?: number): string => {
  if (!seconds || seconds === 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const getFileIcon = (name?: string): string => {
  if (!name) return "document-text-outline";
  const ext = name.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    pdf: "document-text-outline",
    doc: "document-text-outline",
    docx: "document-text-outline",
    xls: "grid-outline",
    xlsx: "grid-outline",
    ppt: "easel-outline",
    pptx: "easel-outline",
    zip: "archive-outline",
    rar: "archive-outline",
    txt: "document-outline",
    csv: "document-outline",
  };
  return iconMap[ext || ""] || "document-outline";
};

const getFileColor = (name?: string): string => {
  if (!name) return "#007AFF";
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

// ============================================
// IMAGE BUBBLE
// ============================================

interface ImageBubbleProps {
  uri: string;
  isOwnMessage: boolean;
  onPress: () => void;
  onLongPress?: (event: any) => void;
}

const ImageBubble = memo(
  ({ uri, isOwnMessage, onPress, onLongPress }: ImageBubbleProps) => {
    const [loading, setLoading] = useState(true);

    return (
      <TouchableOpacity
        style={styles.mediaWrapper}
        activeOpacity={0.92}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        {loading && (
          <View style={styles.mediaLoadingOverlay}>
            <ActivityIndicator
              size="small"
              color={isOwnMessage ? "#fff" : "#007AFF"}
            />
          </View>
        )}
        <Image
          source={{ uri }}
          style={styles.mediaContent}
          placeholder={{ blurhash: PHOTO_BLURHASH }}
          placeholderContentFit="cover"
          transition={400}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onLoadEnd={() => setLoading(false)}
        />
      </TouchableOpacity>
    );
  },
);

ImageBubble.displayName = "ImageBubble";

// ============================================
// VIDEO BUBBLE
// ============================================

interface VideoBubbleProps {
  thumbnailUri?: string;
  duration?: number;
  isSending: boolean;
  onPress: () => void;
  onLongPress?: (event: any) => void;
}

const VideoBubble = memo(
  ({
    thumbnailUri,
    duration,
    isSending,
    onPress,
    onLongPress,
  }: VideoBubbleProps) => {
    return (
      <TouchableOpacity
        style={styles.mediaWrapper}
        activeOpacity={isSending ? 1 : 0.9}
        onPress={isSending ? undefined : onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        {/* Thumbnail */}
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.mediaContent}
            placeholder={{ blurhash: DEFAULT_BLURHASH }}
            placeholderContentFit="cover"
            transition={300}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.4)" />
          </View>
        )}

        {/* Sending overlay */}
        {isSending && (
          <View style={styles.sendingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.sendingText}>Sending...</Text>
          </View>
        )}

        {/* Play button */}
        {!isSending && (
          <View style={styles.playButtonCenter}>
            <View style={styles.playButton}>
              <Ionicons
                name="play"
                size={26}
                color="#fff"
                style={{ marginLeft: 3 }}
              />
            </View>
          </View>
        )}

        {/* Duration badge */}
        {duration != null && duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

VideoBubble.displayName = "VideoBubble";

// ============================================
// MAIN COMPONENT
// ============================================

const AttachmentMessage: React.FC<AttachmentMessageProps> = ({
  type,
  mediaUrl,
  thumbnailUrl,
  mediaName,
  mediaSize,
  mediaDuration,
  locationData,
  isOwnMessage,
  onImagePress,
  onVideoPress,
  onFilePress,
  onLocationPress,
  onLongPress,
}) => {
  if (type === "image" && mediaUrl) {
    return (
      <ImageBubble
        uri={mediaUrl}
        isOwnMessage={isOwnMessage}
        onPress={() => onImagePress?.(mediaUrl)}
        onLongPress={onLongPress}
      />
    );
  }

  if (type === "video" && mediaUrl) {
    const isSending =
      mediaUrl.startsWith("file://") || mediaUrl.startsWith("/");

    return (
      <VideoBubble
        thumbnailUri={thumbnailUrl}
        duration={mediaDuration}
        isSending={isSending}
        onPress={() => onVideoPress?.(mediaUrl)}
        onLongPress={onLongPress}
      />
    );
  }

  if (type === "file" && mediaUrl) {
    const fileColor = getFileColor(mediaName);
    return (
      <TouchableOpacity
        style={[
          styles.fileContainer,
          isOwnMessage ? styles.ownBg : styles.otherBg,
        ]}
        activeOpacity={0.7}
        onPress={() => onFilePress?.(mediaUrl, mediaName || "File")}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        <View style={[styles.fileIcon, { backgroundColor: `${fileColor}20` }]}>
          <Ionicons
            name={getFileIcon(mediaName) as any}
            size={24}
            color={fileColor}
          />
        </View>
        <View style={styles.fileInfo}>
          <Text
            style={[styles.fileName, isOwnMessage && styles.ownText]}
            numberOfLines={2}
          >
            {mediaName || "Document"}
          </Text>
          {mediaSize != null && mediaSize > 0 && (
            <Text
              style={[styles.fileSizeText, isOwnMessage && styles.ownCaption]}
            >
              {formatFileSize(mediaSize)} •{" "}
              {mediaName?.split(".").pop()?.toUpperCase() || "FILE"}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  if (type === "location" && locationData) {
    return (
      <TouchableOpacity
        style={[
          styles.locationContainer,
          isOwnMessage ? styles.ownBg : styles.otherBg,
        ]}
        activeOpacity={0.8}
        onPress={() =>
          onLocationPress?.(locationData.latitude, locationData.longitude)
        }
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        <View style={styles.locationHeader}>
          <Ionicons
            name="location-sharp"
            size={22}
            color={isOwnMessage ? "rgba(255,255,255,0.9)" : "#FF3B30"}
          />
          <Text style={[styles.locationTitle, isOwnMessage && styles.ownText]}>
            Location
          </Text>
        </View>
        {locationData.locationName && (
          <Text
            style={[styles.locationAddress, isOwnMessage && styles.ownCaption]}
            numberOfLines={2}
          >
            {locationData.locationName}
          </Text>
        )}
        <View style={styles.locationMapPreview}>
          <Ionicons
            name="map-outline"
            size={40}
            color={isOwnMessage ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.2)"}
          />
        </View>
      </TouchableOpacity>
    );
  }

  return null;
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Shared media wrapper (image + video same size)
  mediaWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E5EA",
  },
  mediaContent: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  mediaLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 12,
    zIndex: 1,
  },

  // Video-specific
  videoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
  },
  sendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    zIndex: 3,
    gap: 12,
  },
  sendingText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "SofiaSans-Medium",
  },
  playButtonCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SofiaSans-Medium",
  },

  // File
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
    minWidth: IMAGE_WIDTH * 0.8,
  },
  ownBg: { backgroundColor: "#8b5cf6" },
  otherBg: { backgroundColor: "rgba(0,0,0,0.05)" },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  fileInfo: { flex: 1 },
  fileName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
    marginBottom: 3,
  },
  ownText: { color: "#fff" },
  fileSizeText: {
    fontSize: 11,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  ownCaption: { color: "rgba(255,255,255,0.7)" },

  // Location
  locationContainer: {
    borderRadius: 16,
    padding: 16,
    minWidth: IMAGE_WIDTH * 0.8,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  locationAddress: {
    fontSize: 13,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
    marginBottom: 10,
    lineHeight: 18,
  },
  locationMapPreview: {
    height: 80,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default memo(AttachmentMessage);
