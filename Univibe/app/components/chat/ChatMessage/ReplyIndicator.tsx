// app/components/chat/ChatMessage/ReplyIndicator.tsx (UPDATED)

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
    type?: string;
    mediaUrl?: string;
    duration?: number;
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

  const isReplyingToSelf = replyToMessage.senderId === user?.id;

  const getReplyText = () => {
    if (isReplyingToSelf) {
      return "Replying to yourself";
    }
    return `Replying to ${replyToMessage.senderName}`;
  };

  // Render the reply content based on message type
  const renderReplyContent = () => {
    const type = replyToMessage.type;

    if (type === "audio") {
      const duration = replyToMessage.duration || 0;
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const durationText = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      return (
        <View style={styles.voicePreview}>
          <View style={styles.voiceIconWrap}>
            <Ionicons name="mic" size={14} color="#8B5CF6" />
          </View>
          <View style={styles.voiceWaveform}>
            {[10, 14, 8, 16, 10, 12, 8].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: h,
                    backgroundColor: "#8B5CF6",
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.voiceDuration}>
            Voice message • {durationText}
          </Text>
        </View>
      );
    }

    if (type === "image") {
      return (
        <View style={styles.imagePreview}>
          <Ionicons name="image-outline" size={14} color="#8E8E93" />
          <Text style={styles.messagePreview}>Photo</Text>
        </View>
      );
    }

    // Text message - show the actual text
    return (
      <Text style={styles.messagePreview} numberOfLines={2}>
        {replyToMessage.message}
      </Text>
    );
  };

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
        <View style={[styles.accentBar, { backgroundColor: "#8B5CF6" }]} />
        <View style={styles.textContainer}>
          <Text style={[styles.senderName, { color: "#8B5CF6" }]}>
            {getReplyText()}
          </Text>
          {renderReplyContent()}
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
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  accentBar: {
    width: 4,
    minHeight: 40,
    borderRadius: 2,
    marginRight: 12,
    alignSelf: "stretch",
  },
  textContainer: {
    flex: 1,
    flexShrink: 1,
  },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    fontFamily: "SofiaSans-Bold",
  },
  messagePreview: {
    fontSize: 13,
    color: "#65676B",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    flexWrap: "wrap",
  },
  cancelButton: {
    padding: 8,
    marginLeft: 12,
  },
  voicePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  voiceIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  voiceWaveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  imagePreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
