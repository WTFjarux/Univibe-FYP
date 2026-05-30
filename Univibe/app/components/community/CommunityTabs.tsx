// app/components/Community/CommunityTabs.tsx

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

type TabType = "posts" | "events";

interface CommunityTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  pendingRequestsCount?: number;
}

const tabs: { key: TabType; label: string; icon: string }[] = [
  { key: "posts", label: "Posts", icon: "grid-outline" },
  { key: "events", label: "Events", icon: "calendar-outline" },
];

export default function CommunityTabs({
  activeTab,
  onTabChange,
  pendingRequestsCount,
}: CommunityTabsProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.tabBar,
        { borderBottomColor: isDark ? "#334155" : "#e2e8f0" },
      ]}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={16}
            color={
              activeTab === tab.key ? colors.primary : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === tab.key ? colors.primary : colors.textSecondary,
              },
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { flexDirection: "row", borderBottomWidth: 1, marginTop: 8 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  tabLabel: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
});
