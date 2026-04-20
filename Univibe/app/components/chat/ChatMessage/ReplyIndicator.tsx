// app/components/chat/ReplyIndicator.tsx (UPDATED - Same color for all replies)

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../../../lib/contexts/AuthContext";

interface ReplyIndicatorProps {
  replyToMessage: {
    _id: string;
    senderName: string;
    message: string;
    senderId?: string;
  } | null;
  onCancelReply: () => void;
}

export default function ReplyIndicator({
  replyToMessage,
  onCancelReply,
}: ReplyIndicatorProps) {
  const { user } = useAuth();
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (replyToMessage) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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

  // Check if replying to self
  const isReplyingToSelf = replyToMessage.senderId === user?.id;

  // Get the display text
  const getReplyText = () => {
    if (isReplyingToSelf) {
      return "Replying to yourself";
    }
    return `Replying to ${replyToMessage.senderName}`;
  };

  // Keep same color for all replies
  const accentBarColor = "#8B5CF6";
  const senderNameColor = "#8B5CF6";

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.accentBar, { backgroundColor: accentBarColor }]} />
        <View style={styles.textContainer}>
          <Text style={[styles.senderName, { color: senderNameColor }]}>
            {getReplyText()}
          </Text>
          <Text style={styles.messagePreview} numberOfLines={1}>
            {replyToMessage.message}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancelReply} style={styles.cancelButton}>
          <Ionicons name="close" size={22} color="#8E8E93" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E4E6EB",
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  accentBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
    fontFamily: "SofiaSans-Bold",
  },
  messagePreview: {
    fontSize: 13,
    color: "#65676B",
    fontFamily: "SofiaSans-Regular",
  },
  cancelButton: {
    padding: 6,
    marginLeft: 8,
  },
});
