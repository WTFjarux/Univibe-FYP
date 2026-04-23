// app/components/chat/SwipeableChatMessage.tsx

import React, { useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import ChatMessage from "./ChatBubble";
import * as Haptics from "expo-haptics";

const SWIPE_THRESHOLD = 70;

interface SwipeableChatMessageProps {
  message: any;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showTime: boolean;
  formatTime: (dateString: string) => string;
  getFullImageUrl: (url: string) => string;
  DEFAULT_AVATAR: any;
  onAudioPlayed?: (messageId: string) => void;
  onReaction?: (
    messageId: string,
    reaction: string,
    shouldRemove?: boolean,
  ) => void;
  onReply?: (message: any) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (message: any) => void;
  currentUserId?: string;
  highlightedMessageId?: string;
  onScrollToMessage?: (messageId: string) => void;
  // 🔴 Grouping props
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
}

export default function SwipeableChatMessage({
  message,
  isOwnMessage,
  showAvatar,
  showTime,
  formatTime,
  getFullImageUrl,
  DEFAULT_AVATAR,
  onAudioPlayed,
  onReaction,
  onReply,
  onDelete,
  onForward,
  currentUserId,
  highlightedMessageId,
  onScrollToMessage,
  isGrouped,
  isFirstInGroup,
  isLastInGroup,
}: SwipeableChatMessageProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const hasTriggeredRef = useRef(false);

  const isHighlighted = highlightedMessageId === message._id;
  const isMediaType = ["image", "video", "file", "location"].includes(
    message.type,
  );

  // Allow swipe for all messages except temp/sending ones
  const canSwipe =
    message.status !== "sending" && !message._id?.startsWith("temp_");

  // Rubber band effect
  const applyResistance = (value: number, isRightSwipe: boolean) => {
    const threshold = SWIPE_THRESHOLD;
    if (isRightSwipe) {
      if (value <= threshold) return value;
      return threshold + (value - threshold) * 0.2;
    } else {
      const absValue = Math.abs(value);
      if (absValue <= threshold) return value;
      return -threshold - (absValue - threshold) * 0.2;
    }
  };

  // Icon animations
  const rightSwipeOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  const rightSwipeScale = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0.6, 1],
    extrapolate: "clamp",
  });

  const leftSwipeOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -SWIPE_THRESHOLD / 2, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const leftSwipeScale = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0.6],
    extrapolate: "clamp",
  });

  const handleSwipe = ({ nativeEvent }: any) => {
    if (!canSwipe) return;

    if (nativeEvent.state === State.ACTIVE) {
      let newX = 0;

      if (isOwnMessage) {
        if (nativeEvent.translationX < 0) {
          newX = applyResistance(nativeEvent.translationX, false);
          translateX.setValue(newX);

          if (
            Math.abs(nativeEvent.translationX) >= SWIPE_THRESHOLD &&
            !hasTriggeredRef.current
          ) {
            hasTriggeredRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Animated.spring(translateX, {
              toValue: -SWIPE_THRESHOLD - 10,
              useNativeDriver: true,
            }).start();
          }
        }
      } else {
        if (nativeEvent.translationX > 0) {
          newX = applyResistance(nativeEvent.translationX, true);
          translateX.setValue(newX);

          if (
            nativeEvent.translationX >= SWIPE_THRESHOLD &&
            !hasTriggeredRef.current
          ) {
            hasTriggeredRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            Animated.spring(translateX, {
              toValue: SWIPE_THRESHOLD + 10,
              useNativeDriver: true,
            }).start();
          }
        }
      }
    }

    if (nativeEvent.state === State.END) {
      let shouldTriggerReply = false;

      if (isOwnMessage) {
        shouldTriggerReply = nativeEvent.translationX <= -SWIPE_THRESHOLD;
      } else {
        shouldTriggerReply = nativeEvent.translationX >= SWIPE_THRESHOLD;
      }

      if (shouldTriggerReply) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (onReply) onReply(message);
      }

      hasTriggeredRef.current = false;

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    }
  };

  const renderReplyIndicator = () => {
    const iconColor = "#007AFF";

    if (isOwnMessage) {
      return (
        <Animated.View
          style={[
            styles.replyIndicatorRight,
            {
              opacity: leftSwipeOpacity,
              transform: [{ scale: leftSwipeScale }],
              right: 16,
            },
          ]}
        >
          <Ionicons name="return-up-back" size={24} color={iconColor} />
        </Animated.View>
      );
    } else {
      return (
        <Animated.View
          style={[
            styles.replyIndicatorLeft,
            {
              opacity: rightSwipeOpacity,
              transform: [{ scale: rightSwipeScale }],
              left: 16,
            },
          ]}
        >
          <Ionicons name="return-up-back" size={24} color={iconColor} />
        </Animated.View>
      );
    }
  };

  return (
    <View style={styles.container}>
      {renderReplyIndicator()}

      <PanGestureHandler
        onGestureEvent={handleSwipe}
        onHandlerStateChange={handleSwipe}
        activeOffsetX={[-5, 5]}
        failOffsetY={[-10, 10]}
        enabled={canSwipe}
      >
        <View style={styles.wrapper}>
          <Animated.View
            style={[styles.messageContainer, { transform: [{ translateX }] }]}
          >
            <View style={isHighlighted && styles.highlightedMessage}>
              <ChatMessage
                message={message}
                isOwnMessage={isOwnMessage}
                showAvatar={showAvatar}
                showTime={showTime}
                formatTime={formatTime}
                getFullImageUrl={getFullImageUrl}
                DEFAULT_AVATAR={DEFAULT_AVATAR}
                onAudioPlayed={onAudioPlayed}
                onReaction={onReaction}
                onReply={onReply}
                onDelete={onDelete}
                onForward={onForward}
                currentUserId={currentUserId}
                onScrollToMessage={onScrollToMessage}
                // 🔴 Pass grouping props to ChatBubble
                isGrouped={isGrouped}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
              />
            </View>
          </Animated.View>
        </View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  wrapper: {
    position: "relative",
  },
  messageContainer: {
    width: "100%",
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  highlightedMessage: {
    backgroundColor: "rgba(0, 122, 255, 0.08)",
    borderRadius: 12,
    marginVertical: 2,
  },
  replyIndicatorLeft: {
    position: "absolute",
    left: 16,
    top: "50%",
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 2,
  },
  replyIndicatorRight: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 2,
  },
});
