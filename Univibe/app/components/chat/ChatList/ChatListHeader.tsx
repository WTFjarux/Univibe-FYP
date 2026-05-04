// app/components/chat/ChatList/ChatListHeader.tsx

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ChatListHeaderProps {
  onNewChat: () => void;
  onNewGroup?: () => void; // NEW: Optional group creation handler
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ChatListHeader({
  onNewChat,
  onNewGroup,
}: ChatListHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>Messages</Text>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {/* New Group Button (Optional) */}
        {onNewGroup && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNewGroup}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="people-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        )}

        {/* New Chat Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onNewChat}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="create-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#000000",
    fontFamily: "SofiaSans-Bold",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionButton: {
    padding: 4,
  },
});
