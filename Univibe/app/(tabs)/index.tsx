// app/(tabs)/home/index.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome back! 👋</Text>
          <Text style={styles.subtitle}>Your campus feed</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            {/* Updated links to point to correct tab routes */}
            <Link href="./(tabs)/profile" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="person" size={24} color="#8b5cf6" />
                <Text style={styles.actionText}>Profile</Text>
              </TouchableOpacity>
            </Link>

            <Link href="./(tabs)/search" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="search" size={24} color="#055ff1ff" />
                <Text style={styles.actionText}>Search</Text>
              </TouchableOpacity>
            </Link>

            <Link href="./(tabs)/events" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="calendar" size={24} color="#10b981" />
                <Text style={styles.actionText}>Events</Text>
              </TouchableOpacity>
            </Link>

            <Link href="./(tabs)/feed" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <Ionicons name="newspaper" size={24} color="#f59e0b" />
                <Text style={styles.actionText}>Feed</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Feed Placeholder */}
        <View style={styles.feedSection}>
          <Text style={styles.sectionTitle}>Latest Posts</Text>
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>
              Be the first to share something with your campus!
            </Text>
            <Link href="./lan" asChild>
              <TouchableOpacity style={styles.createButton}>
                <Text style={styles.createButtonText}>Go to Feed</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Campus Events */}
        <View style={styles.eventsSection}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No upcoming events</Text>
            <Link href="./(tabs)/events" asChild>
              <TouchableOpacity style={styles.createButton}>
                <Text style={styles.createButtonText}>Browse Events</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>156</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>8</Text>
              <Text style={styles.statLabel}>Groups</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>24</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>3</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  welcome: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 4,
  },
  quickActions: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    width: "48%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  feedSection: {
    padding: 20,
    paddingTop: 0,
  },
  emptyState: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  eventsSection: {
    padding: 20,
    paddingTop: 0,
  },
  statsSection: {
    padding: 20,
    paddingTop: 0,
    marginBottom: 40,
  },
  statsGrid: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    width: "48%",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
});
