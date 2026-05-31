// app/components/Home/QuickActions.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";

export default function QuickActions() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const actions = [
    {
      key: "post",
      label: "Post",
      icon: "create-outline" as const,
      gradient: ["#8b5cf6", "#7c3aed"],
      bgColor: isDark ? "rgba(139, 92, 246, 0.2)" : "#f5f3ff",
      iconColor: "#8b5cf6",
      onPress: () => router.push("/components/Feed/Post/create"),
    },
    {
      key: "event",
      label: "Event",
      icon: "calendar-outline" as const,
      gradient: ["#10b981", "#059669"],
      bgColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#ecfdf5",
      iconColor: "#10b981",
      onPress: () => router.push("/events/create"),
    },
    {
      key: "community",
      label: "Community",
      icon: "people-outline" as const,
      gradient: ["#3b82f6", "#2563eb"],
      bgColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#eff6ff",
      iconColor: "#3b82f6",
      onPress: () => router.push("/screens/CreateCommunityScreen" as any),
    },
    {
      key: "Moment",
      label: "Moment",
      icon: "camera-outline" as const,
      gradient: ["#f59e0b", "#d97706"],
      bgColor: isDark ? "rgba(245, 158, 11, 0.2)" : "#fffbeb",
      iconColor: "#f59e0b",
      onPress: () => router.push("/screens/CreateStoryScreen" as any),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.title}>
        <Text style={styles.titleText}>Create</Text>
      </View>
      <View style={styles.actionsRow}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={styles.actionItem}
            onPress={action.onPress}
            activeOpacity={0.7}
          >
            <View
              style={[styles.actionIcon, { backgroundColor: action.bgColor }]}
            >
              <Ionicons name={action.icon} size={22} color={action.iconColor} />
            </View>
            <Text
              style={[styles.actionLabel, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  title: {
    marginBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontFamily: "SofiaSans-Bold",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionItem: {
    alignItems: "center",
    width: 72,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
    textAlign: "center",
  },
});
