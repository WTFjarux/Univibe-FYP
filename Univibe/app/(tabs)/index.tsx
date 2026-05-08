import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../lib/contexts/AuthContext";
import chatApi from "../../lib/services/chatApi";
import {
  notificationService,
  listenForNotifications,
} from "../../lib/services/notificationService";
import socketService from "../../lib/services/socketService";
import CampusMoments from "../components/CampusMoments";
import type { StoryGroup } from "../../lib/services/storyApi";

const { width } = Dimensions.get("window");

// Skeleton component for the entire home screen
const HomeScreenSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.skeletonContainer}>
      {/* Header Skeleton */}
      <View style={styles.skeletonHeader}>
        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
        <Animated.View style={[styles.skeletonLogo, { opacity }]} />
        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
      </View>

      {/* Stories Skeleton */}
      <View style={styles.skeletonSection}>
        <Animated.View style={[styles.skeletonTitle, { opacity }]} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.skeletonStoriesContainer}
        >
          {[...Array(6)].map((_, index) => (
            <View key={index} style={styles.skeletonStoryCard}>
              <Animated.View style={[styles.skeletonStoryRing, { opacity }]}>
                <Animated.View
                  style={[styles.skeletonStoryAvatar, { opacity }]}
                />
              </Animated.View>
              <Animated.View style={[styles.skeletonStoryName, { opacity }]} />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Events Skeleton */}
      <View style={styles.skeletonSection}>
        <Animated.View style={[styles.skeletonTitle, { opacity }]} />
        {[...Array(3)].map((_, index) => (
          <Animated.View
            key={index}
            style={[styles.skeletonEventCard, { opacity }]}
          >
            <Animated.View style={[styles.skeletonEventDate, { opacity }]} />
            <View style={styles.skeletonEventDetails}>
              <Animated.View style={[styles.skeletonEventName, { opacity }]} />
              <Animated.View style={[styles.skeletonEventMeta, { opacity }]} />
              <Animated.View
                style={[styles.skeletonEventAttendees, { opacity }]}
              />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const initialLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Handle initial loading state
  useEffect(() => {
    // Show skeleton for a minimum time to ensure smooth UX
    initialLoadTimerRef.current = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500); // 1.5 seconds minimum skeleton display

    return () => {
      if (initialLoadTimerRef.current) {
        clearTimeout(initialLoadTimerRef.current);
      }
    };
  }, []);

  // ===== REAL-TIME NOTIFICATION COUNT =====
  useEffect(() => {
    if (!token) return;

    const cleanup = listenForNotifications(
      () => {},
      (count: number) => {
        setUnreadCount(count);
      },
    );

    return () => cleanup();
  }, [token]);

  // ===== REAL-TIME CHAT UNREAD COUNT =====
  useEffect(() => {
    if (!token) return;

    const fetchUnreadChatCount = async () => {
      try {
        const data = await chatApi.getUnreadChatCount();
        if (data.success && data.count !== undefined) {
          setUnreadChatCount(data.count);
        }
      } catch (error) {
        console.error("Error fetching unread chat count:", error);
      }
    };

    // Initial fetch
    fetchUnreadChatCount();

    const debouncedFetch = () => {
      setTimeout(fetchUnreadChatCount, 1000);
    };

    socketService.on("receive_message", debouncedFetch);
    socketService.on("messages_read", debouncedFetch);
    socketService.on("chat_cleared", debouncedFetch);

    return () => {
      socketService.off("receive_message", debouncedFetch);
      socketService.off("messages_read", debouncedFetch);
      socketService.off("chat_cleared", debouncedFetch);
    };
  }, [token]);

  // ===== REFRESH FUNCTIONS =====
  const refreshAll = useCallback(async (showIndicator = true) => {
    if (showIndicator) {
      setRefreshing(true);
    }

    // Trigger CampusMoments refresh by changing key (silent - no pull-down)
    setRefreshTrigger((prev) => prev + 1);

    // Refresh notification count silently
    try {
      const response = await notificationService.getUnreadCount();
      if (response.success && response.count !== undefined) {
        setUnreadCount(response.count);
      }
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }

    if (showIndicator) {
      // Add a small delay to ensure smooth refresh animation
      setTimeout(() => {
        setRefreshing(false);
      }, 800);
    }
  }, []);

  // Refresh silently on screen focus -
  useFocusEffect(
    useCallback(() => {
      if (!isInitialLoading) {
        refreshAll(false);
      }
    }, [refreshAll, isInitialLoading]),
  );

  const handleChatPress = () => {
    setUnreadChatCount(0);
    router.push("/screens/ChatListScreen");
  };

  const handleStoryPress = (storyGroup: StoryGroup) => {
    router.push({
      pathname: "/screens/StoryViewerScreen",
      params: {
        userId: storyGroup.userId,
        userName: storyGroup.userName,
        hasUnseen: String(storyGroup.hasUnseen),
      },
    });
  };

  // Mock data for events
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

  const formatEventDate = (date: string) => {
    const day = date.split(",")[0];
    return day === "Tomorrow" ? "Tom" : day.slice(0, 3);
  };

  // Show full screen skeleton during initial load
  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <HomeScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
            progressBackgroundColor="#ffffff"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleChatPress}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={28} color="#374151" />
            {unreadChatCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.logoText}>UNIVIBE</Text>

          <Link href="/screens/notifications" asChild>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons
                name="notifications-outline"
                size={28}
                color="#374151"
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
        </View>

        {/* Campus Moments Component */}
        <CampusMoments
          key={`campus-moments-${refreshTrigger}`}
          onStoryPress={handleStoryPress}
        />

        {/* Events */}
        <View style={styles.eventsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <Link href="/(tabs)/events" asChild>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>View Calendar</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {upcomingEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventCard}
              activeOpacity={0.7}
            >
              <View style={styles.eventDate}>
                <Text style={styles.eventDateDay}>
                  {formatEventDate(event.date)}
                </Text>
                <Text style={styles.eventDateLabel}>Day</Text>
              </View>

              <View style={styles.eventDetails}>
                <Text style={styles.eventName}>{event.name}</Text>

                <View style={styles.eventMeta}>
                  <View style={styles.eventMetaItem}>
                    <Ionicons name="time-outline" size={14} color="#6b7280" />
                    <Text style={styles.eventMetaText}>{event.date}</Text>
                  </View>

                  <View style={styles.eventMetaItem}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color="#6b7280"
                    />
                    <Text style={styles.eventMetaText}>{event.location}</Text>
                  </View>
                </View>

                <View style={styles.eventAttendees}>
                  <Ionicons name="people-outline" size={12} color="#8b5cf6" />
                  <Text style={styles.attendeesText}>
                    {event.attendees} attending
                  </Text>

                  {/* Visual attendee avatars */}
                  <View style={styles.attendeeAvatars}>
                    {[...Array(Math.min(event.attendees, 3))].map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.attendeeAvatar,
                          { marginLeft: i > 0 ? -8 : 0 },
                        ]}
                      >
                        <Ionicons name="person" size={10} color="#8b5cf6" />
                      </View>
                    ))}
                    {event.attendees > 3 && (
                      <View style={[styles.attendeeAvatar, { marginLeft: -8 }]}>
                        <Text style={styles.attendeeMoreText}>
                          +{event.attendees - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacer} />
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
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Sofia-Regular",
    color: "#111827",
    letterSpacing: 1,
  },
  iconButton: {
    position: "relative",
    padding: 8,
    borderRadius: 12,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  eventsSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  eventCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  eventDate: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  eventDateDay: {
    fontSize: 16,
    fontWeight: "700",
    color: "#8b5cf6",
  },
  eventDateLabel: {
    fontSize: 10,
    color: "#8b5cf6",
    fontWeight: "500",
  },
  eventDetails: {
    flex: 1,
    marginRight: 8,
  },
  eventName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 12,
  },
  eventMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: "#6b7280",
  },
  eventAttendees: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  attendeesText: {
    fontSize: 12,
    color: "#8b5cf6",
    fontWeight: "500",
  },
  attendeeAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  attendeeAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  attendeeMoreText: {
    fontSize: 8,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  bottomSpacer: {
    height: 40,
  },
  // Skeleton styles
  skeletonContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  skeletonLogo: {
    width: 120,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  skeletonSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  skeletonTitle: {
    width: 150,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    marginBottom: 16,
  },
  skeletonStoriesContainer: {
    flexDirection: "row",
  },
  skeletonStoryCard: {
    alignItems: "center",
    marginRight: 16,
    width: 90,
  },
  skeletonStoryRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f3f4f6",
    marginBottom: 8,
    borderWidth: 3,
    borderColor: "#e5e7eb",
  },
  skeletonStoryAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    margin: 2,
  },
  skeletonStoryName: {
    width: 70,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonEventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
  },
  skeletonEventDate: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    marginRight: 14,
  },
  skeletonEventDetails: {
    flex: 1,
    gap: 8,
  },
  skeletonEventName: {
    width: "70%",
    height: 16,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonEventMeta: {
    width: "90%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonEventAttendees: {
    width: "40%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
});
