/**
 * app/components/chat/ChatMessage/ChatImageViewer.tsx
 * ChatImageViewer - Full-screen image viewer modal
 *
 * Features:
 * - Blur background overlay
 * - Tap anywhere to close
 * - Single image display
 * - Proper image fitting with aspect ratio preservation
 * - Close button with hit slop for easy tapping
 */

import React from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableWithoutFeedback,
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ChatImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const PHOTO_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export default function ChatImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ChatImageViewerProps) {
  const currentImage = images[initialIndex] || images[0];

  if (!currentImage) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Tap anywhere to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.container}>
          {/* Blur background */}
          <BlurView
            intensity={90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />

          {/* Dark overlay for better contrast */}
          <View style={styles.overlay} />

          {/* Image centered in available space */}
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: currentImage }}
              style={styles.image}
              placeholder={{ blurhash: PHOTO_BLURHASH }}
              placeholderContentFit="contain"
              transition={500}
              contentFit="contain"
              cachePolicy="memory-disk"
              recyclingKey={currentImage}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 999,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 100, // Space for close button
    paddingBottom: 50, // Bottom spacing
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
