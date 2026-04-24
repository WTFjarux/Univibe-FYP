// app/components/chat/ChatMessage/AttachmentMessage.tsx

import React, { useState, useCallback, memo } from "react";
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
// FIXED DIMENSIONS (like Instagram/Messenger)
// ============================================

const IMAGE_WIDTH = SCREEN_WIDTH * 0.55; // Fixed width
const IMAGE_HEIGHT = IMAGE_WIDTH * 1.25; // 5:4 aspect ratio portrait
const IMAGE_HEIGHT_LANDSCAPE = IMAGE_WIDTH * 0.7; // 4:3 landscape for wide images
const MIN_IMAGE_WIDTH = 120;

// ✅ Blurhash strings for placeholder (you can generate per-image from backend)
const DEFAULT_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const PHOTO_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface AttachmentMessageProps {
  type: "image" | "video" | "file" | "location";
  mediaUrl?: string;
  thumbnailUrl?: string; // ✅ Optional thumbnail for progressive loading
  mediaName?: string;
  mediaSize?: number;
  mediaMimeType?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    locationName?: string;
  };
  isOwnMessage: boolean;
  onImagePress?: (url: string) => void;
  onFilePress?: (url: string, name: string) => void;
  onLocationPress?: (latitude: number, longitude: number) => void;
}

// ============================================
// HELPERS (outside component = no re-creation)
// ============================================

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
// IMAGE RENDERER (optimized)
// ============================================

interface ImageBubbleProps {
  uri: string;
  thumbnailUri?: string;
  isOwnMessage: boolean;
  onPress: () => void;
}

const ImageBubble = memo(
  ({ uri, thumbnailUri, isOwnMessage, onPress }: ImageBubbleProps) => {
    const [loading, setLoading] = useState(true);

    return (
      <TouchableOpacity
        style={styles.imageWrapper}
        activeOpacity={0.92}
        onPress={onPress}
      >
        {/* ✅ Loading indicator */}
        {loading && (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator
              size="small"
              color={isOwnMessage ? "#fff" : "#007AFF"}
            />
          </View>
        )}

        {/* ✅ expo-image with blurhash placeholder + fade-in transition */}
        <Image
          source={{ uri }}
          style={styles.image}
          placeholder={{ blurhash: PHOTO_BLURHASH }}
          placeholderContentFit="cover"
          transition={400} // ✅ Smooth fade-in
          contentFit="cover"
          cachePolicy="memory-disk" // ✅ Aggressive caching
          recyclingKey={uri} // ✅ FlatList recycling
          onLoadEnd={() => setLoading(false)}
        />
      </TouchableOpacity>
    );
  },
);

ImageBubble.displayName = "ImageBubble";

// ============================================
// MAIN COMPONENT
// ============================================

const AttachmentMessage: React.FC<AttachmentMessageProps> = ({
  type,
  mediaUrl,
  thumbnailUrl,
  mediaName,
  mediaSize,
  locationData,
  isOwnMessage,
  onImagePress,
  onFilePress,
  onLocationPress,
}) => {
  // ============================================
  // IMAGE (fixed size, no getSize, blurhash placeholder)
  // ============================================
  if (type === "image" && mediaUrl) {
    return (
      <ImageBubble
        uri={mediaUrl}
        thumbnailUri={thumbnailUrl}
        isOwnMessage={isOwnMessage}
        onPress={() => onImagePress?.(mediaUrl)}
      />
    );
  }

  // ============================================
  // VIDEO RENDERER
  // ============================================
  if (type === "video" && mediaUrl) {
    return (
      <TouchableOpacity
        style={[
          styles.videoContainer,
          isOwnMessage ? styles.ownBg : styles.otherBg,
        ]}
        activeOpacity={0.9}
        onPress={() => onImagePress?.(mediaUrl)}
      >
        <View style={styles.videoPlayButton}>
          <Ionicons name="play-circle" size={44} color="#fff" />
        </View>
        <View style={styles.videoInfo}>
          <Ionicons
            name="videocam"
            size={16}
            color={isOwnMessage ? "rgba(255,255,255,0.8)" : "#666"}
          />
          <Text style={[styles.videoText, isOwnMessage && styles.ownText]}>
            Video
          </Text>
        </View>
        {mediaSize != null && mediaSize > 0 && (
          <Text style={[styles.videoSize, isOwnMessage && styles.ownCaption]}>
            {formatFileSize(mediaSize)}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // ============================================
  // FILE/DOCUMENT RENDERER
  // ============================================
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

  // ============================================
  // LOCATION RENDERER
  // ============================================
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
  // Image - FIXED dimensions
  imageWrapper: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5E5EA",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    borderRadius: 12,
    zIndex: 1,
  },

  // Video
  videoContainer: {
    borderRadius: 16,
    overflow: "hidden",
    width: IMAGE_WIDTH,
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  ownBg: { backgroundColor: "rgba(0,0,0,0.15)" },
  otherBg: { backgroundColor: "rgba(0,0,0,0.05)" },
  videoPlayButton: {
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  videoInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  videoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    fontFamily: "SofiaSans-Medium",
  },
  ownText: { color: "#fff" },
  videoSize: {
    fontSize: 11,
    color: "#8E8E93",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  ownCaption: { color: "rgba(255,255,255,0.7)" },

  // File
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
    minWidth: IMAGE_WIDTH * 0.8,
  },
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
  fileSizeText: {
    fontSize: 11,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },

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
