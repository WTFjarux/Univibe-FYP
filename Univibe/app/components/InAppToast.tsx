// app/components/InAppToast.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useTheme } from "../../lib/contexts/ThemeContext";
import {
  InAppNotification,
  ToastType,
  TOAST_CONFIG,
} from "../../lib/types/inAppNotification";
import { useInAppNotification } from "../../lib/contexts/InAppNotificationContext";

// ============================================
// CONSTANTS
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================
// TOAST ICON CONFIG
// ============================================

interface ToastIconConfig {
  iconName: keyof typeof Ionicons.glyphMap;
  bgColor: string;
  iconColor: string;
}

const TOAST_ICONS: Record<ToastType, ToastIconConfig> = {
  [ToastType.MESSAGE]: {
    iconName: "chatbubble",
    bgColor: "#8B5CF6",
    iconColor: "#FFFFFF",
  },
  [ToastType.LIKE]: {
    iconName: "heart",
    bgColor: "#EF4444",
    iconColor: "#FFFFFF",
  },
  [ToastType.COMMENT]: {
    iconName: "chatbubble-ellipses",
    bgColor: "#8B5CF6",
    iconColor: "#FFFFFF",
  },
  [ToastType.REPLY]: {
    iconName: "return-down-back",
    bgColor: "#6366F1",
    iconColor: "#FFFFFF",
  },
  [ToastType.EVENT]: {
    iconName: "calendar",
    bgColor: "#F59E0B",
    iconColor: "#FFFFFF",
  },
  [ToastType.CONNECTION]: {
    iconName: "person-add",
    bgColor: "#10B981",
    iconColor: "#FFFFFF",
  },
  [ToastType.COMMUNITY]: {
    iconName: "people",
    bgColor: "#8B5CF6",
    iconColor: "#FFFFFF",
  },
};

// ============================================
// TOAST CONTENT (Inner Component)
// ============================================

interface ToastContentProps {
  toast: InAppNotification;
  onPress: () => void;
  onDismiss: () => void;
}

const ToastContent: React.FC<ToastContentProps> = React.memo(
  ({ toast, onPress, onDismiss }) => {
    const iconConfig = TOAST_ICONS[toast.type];
    const isGroupMessage = toast.isGroupMessage || false;
    const isCommunity = toast.type === ToastType.COMMUNITY;
    const { colors } = useTheme();

    // Determine which left content to show (avatar or icon)
    const renderLeftContent = () => {
      // Case 1: Has a valid avatar URL (community image, group photo, or user avatar)
      if (toast.senderAvatar) {
        return (
          <Image
            source={{ uri: toast.senderAvatar }}
            style={[styles.avatar, { backgroundColor: colors.skeleton }]}
            placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        );
      }

      // Case 2: Community notification without image → community icon
      if (isCommunity) {
        return (
          <View style={[styles.iconBadge, { backgroundColor: "#8B5CF6" }]}>
            <Ionicons name="people" size={22} color="#FFFFFF" />
          </View>
        );
      }

      // Case 3: Group message without photo → group icon
      if (isGroupMessage) {
        return (
          <View style={[styles.iconBadge, { backgroundColor: "#8B5CF6" }]}>
            <Ionicons name="people" size={22} color="#FFFFFF" />
          </View>
        );
      }

      // Case 4: Direct message without avatar → person icon
      if (toast.type === ToastType.MESSAGE) {
        return (
          <View
            style={[styles.iconBadge, { backgroundColor: iconConfig.bgColor }]}
          >
            <Ionicons name="person" size={22} color={iconConfig.iconColor} />
          </View>
        );
      }

      // Case 5: Other types (likes, comments, events, etc.) → type-specific icon
      return (
        <View
          style={[styles.iconBadge, { backgroundColor: iconConfig.bgColor }]}
        >
          <Ionicons
            name={iconConfig.iconName}
            size={20}
            color={iconConfig.iconColor}
          />
        </View>
      );
    };

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.toastContent,
          { backgroundColor: colors.card, shadowColor: colors.shadow },
        ]}
      >
        {/* LEFT: Avatar or Icon */}
        <View style={styles.iconContainer}>{renderLeftContent()}</View>

        {/* CENTER: Title & Body */}
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {toast.title}
            </Text>
            {/* Badge for group messages */}
            {isGroupMessage && !isCommunity && (
              <View style={styles.badge}>
                <Ionicons name="people" size={10} color="#8B5CF6" />
              </View>
            )}
            {/* Badge for community notifications */}
            {isCommunity && (
              <View style={styles.badge}>
                <Ionicons name="people" size={10} color="#8B5CF6" />
              </View>
            )}
          </View>
          <Text
            style={[styles.body, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {toast.body}
          </Text>
        </View>

        {/* RIGHT: Close button */}
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
);

// ============================================
// MAIN TOAST COMPONENT
// ============================================

const InAppToast: React.FC = () => {
  const { currentToast, isVisible, hideToast } = useInAppNotification();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Stable copy of toast to prevent flashing old data
  const [displayedToast, setDisplayedToast] =
    useState<InAppNotification | null>(null);
  const translateY = useSharedValue(-200);
  const opacity = useSharedValue(0);
  const wasVisible = useRef(false);

  // Update displayed toast when currentToast changes
  useEffect(() => {
    if (currentToast) {
      setDisplayedToast(currentToast);
    }
  }, [currentToast]);

  // Clear displayed toast after hide animation finishes
  const clearDisplayed = () => {
    if (!isVisible) {
      setDisplayedToast(null);
    }
  };

  // Animation logic
  useEffect(() => {
    if (isVisible && !wasVisible.current) {
      // Slide in
      translateY.value = withTiming(0, {
        duration: TOAST_CONFIG.SLIDE_IN_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, { duration: 200 });
      wasVisible.current = true;
    } else if (!isVisible && wasVisible.current) {
      // Slide out
      translateY.value = withTiming(
        -200,
        {
          duration: TOAST_CONFIG.SLIDE_OUT_DURATION,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(clearDisplayed)();
          }
        },
      );
      opacity.value = withTiming(0, {
        duration: TOAST_CONFIG.SLIDE_OUT_DURATION,
      });
      wasVisible.current = false;
    } else if (isVisible && wasVisible.current && currentToast) {
      // Already visible, new content — keep position
      translateY.value = 0;
      opacity.value = 1;
    }
  }, [isVisible, currentToast?.id]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Press handler — navigate on tap
  const handlePress = () => {
    if (!displayedToast) return;
    hideToast();

    if (displayedToast.navigationTarget) {
      const { screen, params } = displayedToast.navigationTarget;
      setTimeout(() => {
        router.push({
          pathname: screen as any,
          params: params || {},
        });
      }, 150);
    }
  };

  // Dismiss handler
  const handleDismiss = () => {
    hideToast();
  };

  // Don't render if no toast to display
  if (!displayedToast) return null;

  const topPosition = insets.top + 8;

  return (
    <Animated.View
      key={displayedToast.id}
      style={[styles.container, animatedStyle, { top: topPosition }]}
    >
      <ToastContent
        toast={displayedToast}
        onPress={handlePress}
        onDismiss={handleDismiss}
      />
    </Animated.View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "SofiaSans-Bold",
    flex: 1,
  },
  badge: {
    marginLeft: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
});

export default InAppToast;
