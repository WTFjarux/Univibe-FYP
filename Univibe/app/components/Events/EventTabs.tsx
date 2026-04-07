// components/EventTabs.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    <View style={styles.tabsContainer}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => onTabChange(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={activeTab === tab.key ? "#8b5cf6" : "#6b7280"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive,
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
    borderBottomColor: "#f3f4f6",
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
  tabActive: {
    borderBottomColor: "#8b5cf6",
  },
  tabText: {
    fontSize: 15,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  tabTextActive: {
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
  },
});

export default EventTabs;