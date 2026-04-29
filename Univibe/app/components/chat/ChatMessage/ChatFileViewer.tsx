// app/components/chat/ChatMessage/ChatFileViewer.tsx

import React, { useState, useCallback } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Text,
  Share,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ChatFileViewerProps {
  visible: boolean;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  onClose: () => void;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExtension = (name: string): string => {
  return name.split(".").pop()?.toUpperCase() || "FILE";
};

const getFileIcon = (name: string): keyof typeof Ionicons.glyphMap => {
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
  return iconMap[ext || ""] || "document";
};

const getFileColor = (name: string): string => {
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

const isTextFile = (name: string): boolean => {
  const ext = name.split(".").pop()?.toLowerCase();
  return [
    "txt",
    "csv",
    "json",
    "xml",
    "log",
    "md",
    "js",
    "ts",
    "html",
    "css",
  ].includes(ext || "");
};

export default function ChatFileViewer({
  visible,
  fileUrl,
  fileName,
  fileSize,
  onClose,
}: ChatFileViewerProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileColor = getFileColor(fileName);
  const fileIcon = getFileIcon(fileName);
  const fileExt = getFileExtension(fileName);
  const canPreviewText = isTextFile(fileName);

  const downloadFile = useCallback(async () => {
    setDownloading(true);
    setError(null);

    try {
      // Add timestamp to avoid "Destination already exists" error
      const uniqueName = `${Date.now()}_${fileName}`;
      const outputFile = new File(Paths.cache, uniqueName);

      const result = await File.downloadFileAsync(fileUrl, outputFile);

      if (result.exists) {
        setLocalUri(result.uri);
        setDownloaded(true);

        if (canPreviewText) {
          const content = await result.text();
          setFileContent(content);
        }
      } else {
        setError("Failed to download file");
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Could not download file");
    } finally {
      setDownloading(false);
    }
  }, [fileUrl, fileName, canPreviewText]);

  const handleOpenFile = useCallback(async () => {
    if (!localUri) {
      await downloadFile();
    }

    try {
      // Try to open with the system file viewer
      const canOpen = await Linking.canOpenURL(localUri || fileUrl);
      if (canOpen) {
        await Linking.openURL(localUri || fileUrl);
      } else {
        // Fallback to share
        await Share.share({ url: localUri || fileUrl });
      }
    } catch (err) {
      Alert.alert(
        "Error",
        "Could not open file. Try saving and opening manually.",
      );
    }
  }, [localUri, fileUrl, downloadFile]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ url: localUri || fileUrl });
    } catch (err) {
      console.error("Share error:", err);
    }
  }, [localUri, fileUrl]);

  // Auto-download non-text files when opened
  const handleOpen = useCallback(() => {
    if (!canPreviewText && !downloaded) {
      downloadFile();
    }
  }, [canPreviewText, downloaded, downloadFile]);

  if (!fileUrl || !fileName) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Content */}
      <View style={styles.content}>
        {/* File icon */}
        <View
          style={[
            styles.fileIconContainer,
            { backgroundColor: `${fileColor}20` },
          ]}
        >
          <Ionicons name={fileIcon} size={64} color={fileColor} />
        </View>

        {/* File name */}
        <Text style={styles.fileName} numberOfLines={2}>
          {fileName}
        </Text>

        {/* File info */}
        <View style={styles.fileInfoRow}>
          <Text style={styles.fileInfoText}>{fileExt}</Text>
          {fileSize ? (
            <Text style={styles.fileInfoText}>
              {" "}
              • {formatFileSize(fileSize)}
            </Text>
          ) : null}
        </View>

        {/* Text preview for text files */}
        {canPreviewText && fileContent && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewText} numberOfLines={20}>
              {fileContent}
            </Text>
          </View>
        )}

        {/* Non-previewable file message */}
        {!canPreviewText && (
          <View style={styles.infoContainer}>
            <Ionicons
              name="information-circle"
              size={24}
              color="rgba(255,255,255,0.5)"
            />
            <Text style={styles.infoText}>
              {downloaded
                ? "File ready to open"
                : "File will be downloaded for viewing"}
            </Text>
          </View>
        )}

        {/* Download progress */}
        {downloading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Downloading...</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={32} color="#FF3B30" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleOpenFile}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIcon, { backgroundColor: "#8B5CF6" }]}>
            <Ionicons name="eye-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.actionText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: "rgba(255,255,255,0.2)" },
            ]}
          >
            <Ionicons name="share-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={downloadFile}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.actionIcon,
              { backgroundColor: "rgba(255,255,255,0.2)" },
            ]}
          >
            <Ionicons name="download-outline" size={22} color="#fff" />
          </View>
          <Text style={styles.actionText}>Download</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  fileIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  fileName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 8,
  },
  fileInfoRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  fileInfoText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "SofiaSans-Regular",
  },
  previewContainer: {
    width: SCREEN_WIDTH - 48,
    maxHeight: SCREEN_HEIGHT * 0.4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
  },
  previewText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 20,
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "SofiaSans-Regular",
  },
  loadingContainer: {
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "SofiaSans-Regular",
  },
  errorContainer: {
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#FF3B30",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    paddingBottom: 50,
  },
  actionButton: {
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    fontSize: 12,
    color: "#fff",
    fontFamily: "SofiaSans-Regular",
  },
});
