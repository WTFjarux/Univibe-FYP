// app/(tabs)/events/index.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { eventService, Event } from "@/lib/services/eventService";
import EventCard from "@/app/components/Events/EventCard";
import EventCategory from "@/app/components/Events/EventCategory";
import { useAuth } from "@/lib/contexts/AuthContext";
import socketService from "@/lib/services/socketService";

// Use a Set to track processed socket updates and prevent duplicate processing
const processedUpdates = new Set<string>();

// Base categories without counts (counts will be set dynamically)
const baseCategories = [
  { id: "all", name: "All", icon: "grid" },
  { id: "Academic", name: "Academic", icon: "school" },
  { id: "Social", name: "Social", icon: "people" },
  { id: "Sports", name: "Sports", icon: "basketball" },
  { id: "Career", name: "Career", icon: "briefcase" },
  { id: "Cultural", name: "Cultural", icon: "color-palette" },
  { id: "Workshop", name: "Workshop", icon: "construct" },
];

export default function EventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [categories, setCategories] = useState(
    baseCategories.map((cat) => ({ ...cat, count: 0 })),
  );

  // Track pending optimistic updates
  const pendingUpdates = useRef<
    Map<string, { type: string; timestamp: number }>
  >(new Map());

  // Update category counts whenever events change
  useEffect(() => {
    const newCategories = baseCategories.map((cat) => {
      if (cat.id === "all") {
        return { ...cat, count: events.length };
      }
      const count = events.filter((event) => event.category === cat.id).length;
      return { ...cat, count };
    });
    setCategories(newCategories);
  }, [events]);

  const deduplicateEvents = (eventsArray: Event[]): Event[] => {
    const seen = new Map<string, Event>();
    eventsArray.forEach((event) => {
      if (!seen.has(event._id)) {
        seen.set(event._id, event);
      }
    });
    return Array.from(seen.values());
  };

  const fetchEvents = async (refresh = false) => {
    if (refresh) {
      setPage(1);
      setHasMore(true);
      // Clear cache on refresh to always get fresh data
      eventService.clearCache();
    }

    try {
      const params: any = {
        page: refresh ? 1 : page,
        limit: 10,
        skipCache: refresh, // Skip cache when refreshing
      };
      if (selectedCategory !== "all") params.category = selectedCategory;

      const response = await eventService.getEvents(params);

      if (response.success) {
        const newEvents = response.data;

        if (refresh) {
          setEvents(newEvents);
          // Join event rooms for all new events
          newEvents.forEach((event) => {
            socketService.joinRoom(`event_${event._id}`, null, "event");
          });
        } else {
          setEvents((prev) => deduplicateEvents([...prev, ...newEvents]));
          // Join event rooms for newly loaded events
          newEvents.forEach((event) => {
            socketService.joinRoom(`event_${event._id}`, null, "event");
          });
        }

        setHasMore(response.pagination.pages > (refresh ? 1 : page));
        if (!refresh) setPage((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ===== REAL-TIME EVENT UPDATES VIA SOCKET =====
  useEffect(() => {
    const handleEventUpdate = (data: any) => {
      setEvents((prev) => {
        const newEvents = prev.map((event) => {
          if (event._id !== data.eventId) return event;

          return {
            ...event,
            status: (data.status as Event["status"]) ?? event.status,
            interestedCount: data.interestedCount ?? event.interestedCount ?? 0,
            rsvpCount: data.rsvpCount ?? event.rsvpCount ?? 0,
            isFull: data.isFull ?? event.isFull,
          };
        });
        return newEvents;
      });
    };

    socketService.on("event:updated", handleEventUpdate);

    return () => {
      socketService.off("event:updated", handleEventUpdate);
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };

  const loadMore = () => {
    if (!loading && hasMore && !refreshing) {
      fetchEvents(false);
    }
  };

  // Optimistic update for interest
  const handleInterest = async (eventId: string) => {
    const event = events.find((e) => e._id === eventId);
    if (!event) return;

    // Track this optimistic update
    pendingUpdates.current.set(eventId, {
      type: "interest",
      timestamp: Date.now(),
    });

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((e) => {
        if (e._id !== eventId) return e;
        const currentCount = e.interestedCount ?? 0;
        return {
          ...e,
          isInterested: !e.isInterested,
          interestedCount: e.isInterested
            ? Math.max(0, currentCount - 1)
            : currentCount + 1,
        };
      }),
    );

    try {
      const response = await eventService.toggleInterest(eventId);
      // Clean up pending update
      pendingUpdates.current.delete(eventId);

      if (response.success) {
        // Server-confirmed update
        setEvents((prev) =>
          prev.map((e) => {
            if (e._id !== eventId) return e;
            return {
              ...e,
              isInterested: response.isInterested ?? !e.isInterested,
              interestedCount:
                response.interestedCount ?? e.interestedCount ?? 0,
            };
          }),
        );
      } else {
        // Revert on failure
        revertOptimisticUpdate(eventId, "interest");
      }
    } catch (error) {
      // Clean up and revert on error
      pendingUpdates.current.delete(eventId);
      revertOptimisticUpdate(eventId, "interest");
    }
  };

  // Optimistic update for RSVP
  const handleRsvp = async (eventId: string) => {
    const event = events.find((e) => e._id === eventId);
    if (!event) return;

    const wasRsvpd = event.isRsvpd ?? false;
    const currentCount = event.rsvpCount ?? 0;

    // Calculate new count safely
    const newRsvpCount = wasRsvpd
      ? Math.max(0, currentCount - 1) // Removing RSVP
      : currentCount + 1; // Adding RSVP

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((e) => {
        if (e._id !== eventId) return e;
        return {
          ...e,
          isRsvpd: !wasRsvpd,
          rsvpCount: newRsvpCount,
        };
      }),
    );

    try {
      const response = await eventService.toggleRsvp(eventId);

      if (response.success) {
        // Use server values, but fall back to optimistic if undefined
        const serverRsvpCount =
          response.rsvpCount !== undefined ? response.rsvpCount : newRsvpCount;

        const serverIsRsvpd =
          response.isRsvpd !== undefined ? response.isRsvpd : !wasRsvpd;

        // Cast the status to the correct type
        const serverStatus: Event["status"] =
          (response.status as Event["status"]) ?? event.status;

        setEvents((prev) =>
          prev.map((e) => {
            if (e._id !== eventId) return e;
            return {
              ...e,
              isRsvpd: serverIsRsvpd,
              rsvpCount: serverRsvpCount,
              isFull: response.isFull ?? e.isFull,
              status: serverStatus,
            };
          }),
        );
      } else {
        // Revert on failure
        setEvents((prev) =>
          prev.map((e) => {
            if (e._id !== eventId) return e;
            return {
              ...e,
              isRsvpd: wasRsvpd,
              rsvpCount: currentCount,
            };
          }),
        );
      }
    } catch (error) {
      console.error("💥 Error, reverting:", error);
      // Revert on error
      setEvents((prev) =>
        prev.map((e) => {
          if (e._id !== eventId) return e;
          return {
            ...e,
            isRsvpd: wasRsvpd,
            rsvpCount: currentCount,
          };
        }),
      );
    }
  };

  // Helper to revert optimistic updates
  const revertOptimisticUpdate = (
    eventId: string,
    type: "interest" | "rsvp",
  ) => {
    setEvents((prev) =>
      prev.map((e) => {
        if (e._id !== eventId) return e;
        return {
          ...e,
          isInterested: type === "interest" ? !e.isInterested : e.isInterested,
          interestedCount:
            type === "interest"
              ? e.isInterested
                ? (e.interestedCount ?? 0) + 1
                : Math.max(0, (e.interestedCount ?? 0) - 1)
              : e.interestedCount,
          isRsvpd: type === "rsvp" ? !e.isRsvpd : e.isRsvpd,
          rsvpCount:
            type === "rsvp"
              ? e.isRsvpd
                ? (e.rsvpCount ?? 0) + 1
                : Math.max(0, (e.rsvpCount ?? 0) - 1)
              : e.rsvpCount,
        };
      }),
    );
  };

  useFocusEffect(
    useCallback(() => {
      eventService.clearCache(); // Always clear cache on focus
      fetchEvents(true);
    }, []), // Empty array = always run on focus, but only create callback once
  );

  if (loading && events.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 100;
          if (isCloseToBottom && hasMore && !loading && !refreshing) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Events</Text>
            <Text style={styles.subtitle}>Discover campus happenings</Text>
          </View>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Ionicons name="search-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <EventCategory
              key={category.id}
              id={category.id}
              name={category.name}
              icon={category.icon}
              count={category.count}
              isSelected={selectedCategory === category.id}
              onPress={setSelectedCategory}
            />
          ))}
        </ScrollView>

        {/* Events List */}
        <View style={styles.eventsContainer}>
          {events.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateTitle}>No events found</Text>
              <Text style={styles.emptyStateText}>
                Be the first to create an event!
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                currentUserId={currentUserId}
                onInterestPress={handleInterest}
                onRsvpPress={handleRsvp}
              />
            ))
          )}
        </View>

        {loading && events.length > 0 && (
          <ActivityIndicator style={styles.loader} color="#8b5cf6" />
        )}

        {!hasMore && events.length > 0 && (
          <View style={styles.endMessage}>
            <Text style={styles.endMessageText}>No more events to load</Text>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/events/create")}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
  },
  searchIconButton: {
    padding: 8,
  },

  categoriesScroll: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingHorizontal: 20,
  },
  eventsContainer: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
  },
  loader: {
    paddingVertical: 20,
  },
  endMessage: {
    alignItems: "center",
    paddingVertical: 20,
  },
  endMessageText: {
    fontSize: 14,
    color: "#9ca3af",
  },
  bottomPadding: {
    height: 80,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
