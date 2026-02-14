import React, { useRef } from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Platform,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImageViewModalProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  title?: string;
  isCoverPhoto?: boolean;
}

export default function ImageViewModal({
  visible,
  imageUri,
  onClose,
  title,
  isCoverPhoto = false,
}: ImageViewModalProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handleOverlayPress = () => {
    onClose();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
          translateY.setValue(gestureState.dy);

          const scaleValue = Math.max(0.5, 1 - Math.abs(gestureState.dy) / 500);
          scale.setValue(scaleValue);

          const opacityValue = Math.max(0, 1 - Math.abs(gestureState.dy) / 300);
          opacity.setValue(opacityValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) > 100) {
          onClose();
        } else {
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 150,
              friction: 12,
            }),
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 150,
              friction: 12,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              useNativeDriver: true,
              tension: 150,
              friction: 12,
            }),
          ]).start();
        }
      },
    }),
  ).current;

  // If it's a cover photo, use same background but full screen image
  if (isCoverPhoto) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        {/* SAME BLURRED BACKGROUND AS PROFILE PHOTO */}
        <View style={styles.blurOverlay}>
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
          )}

          {/* Tap anywhere to close */}
          <TouchableOpacity
            style={styles.touchOverlay}
            activeOpacity={1}
            onPress={handleOverlayPress}
          />

          {/* Title */}
          {title && (
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{title}</Text>
            </View>
          )}

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Full screen image container */}
          <View style={styles.fullScreenImageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.fullScreenImage}
              resizeMode="contain" // Show full image without cropping
            />
          </View>
        </View>
      </Modal>
    );
  }

  // Original code for profile pictures (circular view)
  const getImageDimensions = () => {
    const size = SCREEN_WIDTH * 0.75; // 75% of screen width
    return { width: size, height: size, borderRadius: size / 2 };
  };

  const imageDimensions = getImageDimensions();

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.blurOverlay}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.androidBlur]} />
        )}

        <TouchableOpacity
          style={styles.touchOverlay}
          activeOpacity={1}
          onPress={handleOverlayPress}
        />

        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [{ translateY: translateY }, { scale: scale }],
              opacity: opacity,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <View
            style={[
              styles.imageWrapper,
              {
                width: imageDimensions.width,
                height: imageDimensions.height,
                borderRadius: imageDimensions.borderRadius,
              },
            ]}
          >
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // SHARED styles for both profile and cover photos
  blurOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  androidBlur: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  titleContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },

  // Profile picture specific styles
  imageContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  imageWrapper: {
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  image: {
    width: "100%",
    height: "100%",
  },

  // Cover photo specific styles (same background, different image container)
  fullScreenImageContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    maxWidth: "100%",
    maxHeight: "100%",
  },
});
