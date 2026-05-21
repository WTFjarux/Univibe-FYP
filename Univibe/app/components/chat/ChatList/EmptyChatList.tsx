// app/components/chat/ChatList/EmptyChatList.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../lib/contexts/ThemeContext";

export default function EmptyChatList() {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={60} color={colors.textMuted} />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        No conversations yet
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        Tap the + icon to start a new chat
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
    fontFamily: "SofiaSans-Regular",
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
});
