// app/components/Community/CommunityBadges.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { CommunityType, PrivacyType } from "../../../lib/types/community";

interface CommunityBadgesProps {
  type: CommunityType;
  privacy: PrivacyType;
}

export default function CommunityBadges({
  type,
  privacy,
}: CommunityBadgesProps) {
  const { colors } = useTheme();
  const isDepartment = type === "department";
  const isPrivate = privacy === "private";

  return (
    <View style={styles.badgeRow}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: isDepartment ? "#10b98120" : colors.primary + "20",
          },
        ]}
      >
        <Ionicons
          name={isDepartment ? "school-outline" : "people-outline"}
          size={12}
          color={isDepartment ? "#10b981" : colors.primary}
        />
        <Text
          style={[
            styles.badgeText,
            { color: isDepartment ? "#10b981" : colors.primary },
          ]}
        >
          {isDepartment ? "Department" : "Community"}
        </Text>
      </View>

      <View
        style={[
          styles.badge,
          { backgroundColor: isPrivate ? "#f59e0b20" : "#10b98120" },
        ]}
      >
        <Ionicons
          name={isPrivate ? "lock-closed-outline" : "globe-outline"}
          size={12}
          color={isPrivate ? "#f59e0b" : "#10b981"}
        />
        <Text
          style={[
            styles.badgeText,
            { color: isPrivate ? "#f59e0b" : "#10b981" },
          ]}
        >
          {isPrivate ? "Private" : "Public"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  badgeText: { fontSize: 11, fontFamily: "SofiaSans-SemiBold" },
});
