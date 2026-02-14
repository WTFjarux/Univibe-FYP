// app/components/Profile/ProfileStats.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProfileStatsProps {
  stats: {
    posts: number;
    connections: number;
    groups: number;
  };
}

// Define valid icon names as const
const STAT_ICONS = {
  posts: "chatbubble-outline" as const,
  connections: "people-outline" as const,
  groups: "people-circle-outline" as const,
};

export default function ProfileStats({ stats }: ProfileStatsProps) {
  const statItems = [
    { key: "posts" as const, label: "Posts", value: stats?.posts || 0 },
    {
      key: "connections" as const,
      label: "Connections",
      value: stats?.connections || 0,
    },
    { key: "groups" as const, label: "Groups", value: stats?.groups || 0 },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Activity</Text>

      <View style={styles.statsContainer}>
        {statItems.map((item) => (
          <StatItem
            key={item.key}
            icon={STAT_ICONS[item.key]}
            label={item.label}
            value={item.value}
          />
        ))}
      </View>
    </View>
  );
}

// StatItem Component with proper typing
interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
}

function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={26} color="#8b5cf6" />
      </View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },
});
