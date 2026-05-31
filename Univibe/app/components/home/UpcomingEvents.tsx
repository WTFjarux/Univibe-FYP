// app/components/Home/UpcomingEvents.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import socketService from "../../../lib/services/socketService";
import {
  eventService,
  Event,
  getFullImageUrl,
} from "../../../lib/services/eventService";

interface UpcomingEventsProps {
  limit?: number;
}

export default function UpcomingEvents({ limit = 3 }: UpcomingEventsProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const response = await eventService.getEvents({
        status: "upcoming",
        limit,
        skipCache: true,
      });
      if (response.success && response.data) {
        setEvents(response.data.slice(0, limit));
      }
    } catch (err) {
      setError("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ✅ Real-time updates via socket
  useEffect(() => {
    const handleEventUpdate = (data: any) => {
      setEvents((prev) =>
        prev.map((event) => {
          if (event._id !== data.eventId) return event;
          return {
            ...event,
            rsvpCount: data.rsvpCount ?? event.rsvpCount,
            interestedCount: data.interestedCount ?? event.interestedCount,
            isFull: data.isFull ?? event.isFull,
            status: (data.status as Event["status"]) ?? event.status,
          };
        }),
      );
    };

    socketService.on("event:updated", handleEventUpdate);
    return () => {
      socketService.off("event:updated", handleEventUpdate);
    };
  }, []);

  // ✅ Refetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents]),
  );

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatEventTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getCategoryColor = (category: string) => {
    const m: Record<string, string> = {
      Academic: "#dbeafe",
      Social: "#fce7f3",
      Sports: "#dcfce7",
      Career: "#fef3c7",
      Cultural: "#ede9fe",
      Workshop: "#fed7aa",
      Other: "#f3f4f6",
    };
    return m[category] || "#f3f4f6";
  };

  const getCategoryTextColor = (category: string) => {
    const m: Record<string, string> = {
      Academic: "#1d4ed8",
      Social: "#be185d",
      Sports: "#15803d",
      Career: "#92400e",
      Cultural: "#6d28d9",
      Workshop: "#9a3412",
      Other: "#374151",
    };
    return m[category] || "#374151";
  };

  const getEventCoverImage = (event: Event): string | null => {
    if (event.coverImageUrl) return event.coverImageUrl;
    if (event.coverImage) return event.coverImage;
    if (event.imageUrls && event.imageUrls.length > 0)
      return event.imageUrls[0];
    return null;
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Upcoming Events
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  // ===== EMPTY =====
  if (error || events.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Upcoming Events
          </Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/events")}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.emptyContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No upcoming events
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Events you create or RSVP to will appear here
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/events/create")}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createButtonText}>Create Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ===== EVENTS =====
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Upcoming Events
        </Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/events")}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>
            See All
          </Text>
        </TouchableOpacity>
      </View>

      {events.map((event) => {
        const coverImage = getEventCoverImage(event);
        return (
          <TouchableOpacity
            key={event._id}
            style={[
              styles.eventCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => router.push(`/events/${event._id}`)}
          >
            {coverImage ? (
              <Image
                source={{ uri: coverImage }}
                style={styles.eventCoverImage}
              />
            ) : (
              <View
                style={[
                  styles.eventDate,
                  { backgroundColor: getCategoryColor(event.category) },
                ]}
              >
                <Text
                  style={[
                    styles.eventDateDay,
                    { color: getCategoryTextColor(event.category) },
                  ]}
                >
                  {formatEventDate(event.startDate)}
                </Text>
                <Text
                  style={[
                    styles.eventDateLabel,
                    { color: getCategoryTextColor(event.category) },
                  ]}
                >
                  {formatEventTime(event.startDate)}
                </Text>
              </View>
            )}
            <View style={styles.eventDetails}>
              <Text
                style={[styles.eventName, { color: colors.text }]}
                numberOfLines={1}
              >
                {event.title}
              </Text>
              <View style={styles.eventMeta}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.eventMetaText,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {formatEventDate(event.startDate)} •{" "}
                  {formatEventTime(event.startDate)}
                </Text>
              </View>
              <View style={styles.eventMeta}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.eventMetaText,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {event.location}
                </Text>
              </View>
              <View style={styles.eventAttendees}>
                <Ionicons
                  name="people-outline"
                  size={12}
                  color={colors.primary}
                />
                <Text style={[styles.attendeesText, { color: colors.primary }]}>
                  {event.rsvpCount || 0} attending
                </Text>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: getCategoryColor(event.category) },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      { color: getCategoryTextColor(event.category) },
                    ]}
                  >
                    {event.category}
                  </Text>
                </View>
                {event.community &&
                  typeof event.community === "object" &&
                  "name" in event.community && (
                    <View style={styles.communityBadge}>
                      <Ionicons name="people" size={10} color="#7c3aed" />
                      <Text style={styles.communityBadgeText}>
                        {event.community.name}
                      </Text>
                    </View>
                  )}
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, marginTop: 8, marginBottom: 40 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontFamily: "SofiaSans-Bold" },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  eventCard: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
  },
  eventCoverImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#f3f4f6",
  },
  eventDate: {
    width: 70,
    height: 70,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  eventDateDay: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "SofiaSans-Bold",
  },
  eventDateLabel: {
    fontSize: 10,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
    marginTop: 2,
  },
  eventDetails: { flex: 1, marginRight: 8 },
  eventName: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    gap: 6,
  },
  eventMetaText: { fontSize: 12, fontFamily: "SofiaSans-Regular", flex: 1 },
  eventAttendees: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  attendeesText: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
  },
  communityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#f5f3ff",
  },
  communityBadgeText: {
    fontSize: 10,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
    color: "#7c3aed",
  },
});
