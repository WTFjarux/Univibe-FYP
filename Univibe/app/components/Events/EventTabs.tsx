// components/EventTabs.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

export type TabType = "details" | "attendees" | "interested";

interface EventTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  rsvpCount: number;
  interestedCount: number;
}

export const EventTabs = ({
  activeTab,
  onTabChange,
  rsvpCount,
  interestedCount,
}: EventTabsProps) => {
  const { colors } = useTheme();

  const tabs = [
    {
      key: "details" as const,
      label: "Details",
      icon: "information-circle-outline",
    },
    {
      key: "attendees" as const,
      label: `Attendees (${rsvpCount})`,
      icon: "people-outline",
    },
    {
      key: "interested" as const,
      label: `Interested (${interestedCount})`,
      icon: "heart-outline",
    },
  ];

  return (
    <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            activeTab === tab.key && [
              styles.tabActive,
              { borderBottomColor: colors.primary },
            ],
          ]}
          onPress={() => onTabChange(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={
              activeTab === tab.key ? colors.primary : colors.textSecondary
            }
          />
          <Text
            style={[
              styles.tabText,
              { color: colors.textSecondary },
              activeTab === tab.key && [
                styles.tabTextActive,
                { color: colors.primary },
              ],
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    marginBottom: 20,
    borderBottomWidth: 1,
    gap: 20,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {},
  tabText: { fontSize: 15, fontFamily: "SofiaSans-Regular" },
  tabTextActive: { fontFamily: "SofiaSans-Bold" },
});

export default EventTabs;
