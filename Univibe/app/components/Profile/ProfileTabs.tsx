// app/components/Profile/ProfileTabs.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type TabType = "posts" | "about";

interface ProfileTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  postCount?: number;
}

export default function ProfileTabs({
  activeTab,
  onTabChange,
  postCount = 0,
}: ProfileTabsProps) {
  return (
    <View style={styles.tabsContainer}>
      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabChange("about")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "about" && styles.activeTabText,

          ]}
        >
          About
        </Text>
        {activeTab === "about" && <View style={styles.underline} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.tab}
        onPress={() => onTabChange("posts")}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "posts" && styles.activeTabText,
          ]}
        >
          Posts {postCount > 0 ? `(${postCount})` : ""}
        </Text>
        {activeTab === "posts" && <View style={styles.underline} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 35,
    paddingVertical: 20,
    gap: 100,
    marginLeft: 50,
  },
  tab: {
    paddingBottom: 4,
  },
  tabText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#9ca3af",
    fontFamily:"SofiaSans-Bold",
  },
  activeTabText: {
    color: "#111827",
    fontWeight: "700",
  },
    underline: {
    position: "absolute",
    bottom: -1,
    left: -8,
    right: -8,
    height: 2,
    backgroundColor: "#000000",
    borderRadius: 1,
  },
});
