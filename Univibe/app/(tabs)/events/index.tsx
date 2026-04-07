// app/(tabs)/events/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { eventService, Event } from "@/lib/eventService";
import EventCard from "@/app/components/Events/EventCard";
import EventCategory from "@/app/components/Events/EventCategory";

const categories = [
  { id: "all", name: "All", icon: "grid", count: 0 },
  { id: "Academic", name: "Academic", icon: "school", count: 0 },
  { id: "Social", name: "Social", icon: "people", count: 0 },
  { id: "Sports", name: "Sports", icon: "basketball", count: 0 },
  { id: "Career", name: "Career", icon: "briefcase", count: 0 },
  { id: "Cultural", name: "Cultural", icon: "color-palette", count: 0 },
  { id: "Workshop", name: "Workshop", icon: "construct", count: 0 },
];

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = async (refresh = false) => {
    if (refresh) {
      setPage(1);
      setHasMore(true);
    }

    
    try {
      const params: any = { page: refresh ? 1 : page, limit: 10 };
      if (selectedCategory !== "all") params.category = selectedCategory;
      if (searchQuery) params.search = searchQuery;

      const response = await eventService.getEvents(params);

      if (response.success) {
        const newEvents = response.data;
        if (refresh) {
          setEvents(newEvents);
        } else {
          setEvents((prev) => [...prev, ...newEvents]);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents(true);
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchEvents(false);
    }
  };

  const handleInterest = async (eventId: string) => {
    try {
      const response = await eventService.toggleInterest(eventId);
      if (response.success) {
        setEvents((prev) =>
          prev.map((event) =>
            event._id === eventId
              ? {
                  ...event,
                  isInterested: response.isInterested,
                  interestedCount: response.interestedCount || 0,
                }
              : event,
          ),
        );
      }
    } catch (error) {
      console.error("Error toggling interest:", error);
    }
  };

  const handleRsvp = async (eventId: string) => {
    try {
      const response = await eventService.toggleRsvp(eventId);
      if (response.success) {
        setEvents((prev) =>
          prev.map((event) =>
            event._id === eventId
              ? {
                  ...event,
                  isRsvpd: response.isRsvpd,
                  rsvpCount: response.rsvpCount || 0,
                  isFull: response.isFull,
                }
              : event,
          ),
        );
      }
    } catch (error) {
      console.error("Error toggling RSVP:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEvents(true);
    }, [selectedCategory, searchQuery]),
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
          if (isCloseToBottom && hasMore && !loading) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header with Search Icon */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Events</Text>
            <Text style={styles.subtitle}>Discover campus happenings</Text>
          </View>
          <TouchableOpacity
            style={styles.searchIconButton}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Ionicons name="search-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Search Bar - Toggle */}
        {showSearch && (
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search events..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9ca3af"
            />
            {searchQuery !== "" && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        )}

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
                {searchQuery
                  ? `No events matching "${searchQuery}"`
                  : "Be the first to create an event!"}
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                onInterestPress={handleInterest}
                onRsvpPress={handleRsvp}
              />
            ))
          )}
        </View>

        {loading && events.length > 0 && (
          <ActivityIndicator style={styles.loader} color="#8b5cf6" />
        )}

        {/* End of Events Message */}
        {!hasMore && events.length > 0 && (
          <View style={styles.endMessage}>
            <Text style={styles.endMessageText}>No more events to load</Text>
          </View>
        )}

        {/* Add extra padding at bottom to prevent content from being hidden behind tab bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Floating Action Button for Create */}
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
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
    height: 80, // Adjust based on your tab bar height
  },
  // Floating Action Button
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
