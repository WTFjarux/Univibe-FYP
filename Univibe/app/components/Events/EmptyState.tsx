// components/EmptyState.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  type: "attendees" | "interested";
}

export const EmptyState = ({ type }: EmptyStateProps) => {
  const config = {
    attendees: {
      icon: "people-outline" as const,
      title: "No attendees yet",
      message: "Be the first to RSVP for this event!",
    },
    interested: {
      icon: "heart-outline" as const,
      title: "No interested users yet",
      message: "Be the first to show interest in this event!",
    },
  };

  const { icon, title, message } = config[type];

  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={48} color="#d1d5db" />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  emptyStateText: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
});

export default EmptyState;