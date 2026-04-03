// app/components/DateSectionHeader.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DateSectionHeaderProps {
  title: string;
}

export default function DateSectionHeader({ title }: DateSectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    letterSpacing: 0.5,
    marginRight: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
});
