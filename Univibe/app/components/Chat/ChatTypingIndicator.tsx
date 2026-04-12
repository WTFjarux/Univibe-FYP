// app/components/chat/ChatTypingIndicator.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ChatTypingIndicatorProps {
  userName: string;
}

export default function ChatTypingIndicator({
  userName,
}: ChatTypingIndicatorProps) {
  return (
    <View style={styles.typingIndicator}>
      <View style={styles.typingBubble}>
        <View style={styles.typingDot} />
        <View style={[styles.typingDot, styles.typingDotMiddle]} />
        <View style={styles.typingDot} />
        <Text style={styles.typingText}> {userName} is typing...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#8E8E93",
    marginHorizontal: 2,
  },
  typingDotMiddle: {
    width: 6,
    height: 6,
  },
  typingText: {
    fontSize: 12,
    color: "#8E8E93",
    marginLeft: 4,
  },
});
