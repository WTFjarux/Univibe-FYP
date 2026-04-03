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
  // Mock data for campus moments (stories)
  const campusMoments = [
    {
      id: 1,
      user: "Alex Chen",
      image: null,
      viewed: false,
      timestamp: "10 min ago",
    },
    {
      id: 2,
      user: "Maria G.",
      image: null,
      viewed: false,
      timestamp: "1 hour ago",
    },
    {
      id: 3,
      user: "James W.",
      image: null,
      viewed: true,
      timestamp: "3 hours ago",
    },
    {
      id: 4,
      user: "Sarah K.",
      image: null,
      viewed: false,
      timestamp: "5 hours ago",
    },
    {
      id: 5,
      user: "Mike T.",
      image: null,
      viewed: true,
      timestamp: "1 day ago",
    },
  ];

  // Mock data for upcoming events
  const upcomingEvents = [
    {
      id: 1,
      name: "Tech Symposium 2024",
      date: "Tomorrow, 2 PM",
      location: "Engineering Hall",
      attendees: 45,
    },
    {
      id: 2,
      name: "Career Fair",
      date: "Apr 10, 10 AM",
      location: "Student Center",
      attendees: 128,
    },
    {
      id: 3,
      name: "Spring Festival",
      date: "Apr 15, 4 PM",
      location: "Main Campus",
      attendees: 234,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Univibe and Icons */}
        <View style={styles.header}>
          <Text style={styles.logoText}>UNIVIBE</Text>
          <View style={styles.headerIcons}>
            {/* Notification Icon */}
            <Link href="./notifications" asChild>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons
                  name="notifications-outline"
                  size={30}
                  color="#374151"
                />
                <View style={styles.badge} />
              </TouchableOpacity>
            </Link>

            {/* Messages Icon */}
            <Link href="./(tabs)/messages" asChild>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="chatbubble-outline" size={30} color="#374151" />
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Campus Moments Section (Stories Style) */}
        <View style={styles.momentsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Campus Moments</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.storiesContainer}
          >
            {/* Add Your Story */}
            <TouchableOpacity style={styles.storyCard}>
              <View style={[styles.storyRing, styles.addStoryRing]}>
                <View style={styles.addStoryContainer}>
                  <Ionicons name="add" size={24} color="#8b5cf6" />
                </View>
              </View>
              <Text style={styles.storyName}>Add Your Moment</Text>
            </TouchableOpacity>

            {/* Campus Moments Stories */}
            {campusMoments.map((moment) => (
              <TouchableOpacity key={moment.id} style={styles.storyCard}>
                <View
                  style={[
                    styles.storyRing,
                    !moment.viewed && styles.unviewedRing,
                  ]}
                >
                  <View style={styles.storyAvatar}>
                    <Text style={styles.avatarText}>
                      {moment.user.charAt(0)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  {moment.user.split(" ")[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Track My Events Section */}
        <View style={styles.eventsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Track My Events</Text>
            <Link href="./(tabs)/events" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>View Calendar</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {upcomingEvents.map((event) => (
            <TouchableOpacity key={event.id} style={styles.eventCard}>
              <View style={styles.eventDate}>
                <Text style={styles.eventDateDay}>
                  {event.date.split(",")[0] === "Tomorrow"
                    ? "Tom"
                    : event.date.split(",")[0].slice(0, 3)}
                </Text>
              </View>
              <View style={styles.eventDetails}>
                <Text style={styles.eventName}>{event.name}</Text>
                <View style={styles.eventMeta}>
                  <Ionicons name="time-outline" size={14} color="#6b7280" />
                  <Text style={styles.eventMetaText}>{event.date}</Text>
                  <Ionicons
                    name="location-outline"
                    size={14}
                    color="#6b7280"
                    style={{ marginLeft: 12 }}
                  />
                  <Text style={styles.eventMetaText}>{event.location}</Text>
                </View>
                <View style={styles.eventAttendees}>
                  <Ionicons name="people-outline" size={12} color="#8b5cf6" />
                  <Text style={styles.attendeesText}>
                    {event.attendees} attending
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
          ))}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  logoText: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "Sofia-Regular",
    color: "#111827",
  },
  headerIcons: {
    flexDirection: "row",
    gap: 30,
  },
  iconButton: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "white",
  },
  momentsSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontWeight: "500",
  },
  storiesContainer: {
    flexDirection: "row",
  },
  storyCard: {
    alignItems: "center",
    marginRight: 16,
    width: 70,
  },
  storyRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginBottom: 8,
  },
  unviewedRing: {
    borderWidth: 2,
    borderColor: "#8b5cf6",
    padding: 2,
  },
  addStoryRing: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
  },
  addStoryContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
  },
  storyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
  },
  storyName: {
    fontSize: 12,
    color: "#374151",
    textAlign: "center",
  },
  eventsSection: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventDate: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  eventDateDay: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8b5cf6",
    textAlign: "center",
  },
  eventDetails: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 4,
  },
  eventAttendees: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeesText: {
    fontSize: 11,
    color: "#8b5cf6",
    marginLeft: 4,
  },
});
