import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const ChatListHeader = ({ onNewChat }: { onNewChat: () => void }) => (
  <View style={styles.header}>
    <Text style={styles.headerTitle}>Messages</Text>
    <TouchableOpacity style={styles.createButton} onPress={onNewChat}>
      <Ionicons name="create-outline" size={24} color="#007AFF" />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 34, fontWeight: "700", color: "#000" },
  createButton: { padding: 8 },
});

export default ChatListHeader;
