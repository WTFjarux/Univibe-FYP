// app/components/chat/ChatList/ChatListHeader.tsx

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../../lib/contexts/ThemeContext";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ChatListHeaderProps {
  onNewChat: () => void;
  onNewGroup?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ChatListHeader({
  onNewChat,
  onNewGroup,
}: ChatListHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>Messages</Text>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {/* New Group Button (Optional) */}
        {onNewGroup && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onNewGroup}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="people-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* New Chat Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onNewChat}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="create-outline" size={24} color={colors.primary} />
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
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
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
