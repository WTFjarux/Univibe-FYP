// app/events/[id].tsx - With real-time socket updates
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { eventService, Event } from "@/lib/services/eventService";
import { useAuth } from "@/lib/contexts/AuthContext";
import { EventImageCarousel } from "@/app/components/Events/EventImageCarousel";
import { UserItem } from "@/app/components/Events/UserItem";
import { EmptyState } from "@/app/components/Events/EmptyState";
import { EventDetailsTab } from "@/app/components/Events/EventDetailsTab";
import { EventActionBar } from "@/app/components/Events/EventActionBar";
import EventOptionsModal from "@/app/components/Events/EventOptionsModal";
import { EventTabs, TabType } from "@/app/components/Events/EventTabs";
import socketService from "@/lib/services/socketService";

interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  profilePicture?: string;
  fullName?: string;
}

interface ExtendedEvent extends Event {
  isSaved?: boolean;
  isReported?: boolean;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [event, setEvent] = useState<ExtendedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showEventOptions, setShowEventOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [attendees, setAttendees] = useState<User[]>([]);
  const [interestedUsers, setInterestedUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const pendingUpdate = useRef<{ type: string; timestamp: number } | null>(
    null,
  );
  const socketSetup = useRef(false);

  const isOrganizer = event?.organizer._id === user?.id;

  useEffect(() => {
    return () => {
      eventService.clearCache();
      socketSetup.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id || socketSetup.current) return;
    socketSetup.current = true;
    socketService.joinRoom(`event_${id}`, null, "event");
    const handleEventUpdate = (data: any) => {
      if (data.eventId !== id) return;
      if (pendingUpdate.current) {
        const age = Date.now() - pendingUpdate.current.timestamp;
        if (age < 2000) return;
      }
      setEvent((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          interestedCount: data.interestedCount ?? prev.interestedCount ?? 0,
          rsvpCount: data.rsvpCount ?? prev.rsvpCount ?? 0,
          isFull: data.isFull ?? prev.isFull,
        };
      });
    };
    socketService.on("event:updated", handleEventUpdate);
    return () => {
      socketService.off("event:updated", handleEventUpdate);
      socketService.leaveRoom(`event_${id}`);
      socketSetup.current = false;
    };
  }, [id]);

  useEffect(() => {
    if (id) fetchEvent();
  }, [id]);

  useEffect(() => {
    if (event && isOrganizer) {
      if (activeTab === "attendees") fetchAttendees();
      else if (activeTab === "interested") fetchInterestedUsers();
    }
  }, [activeTab]);

  const fetchEvent = async () => {
    try {
      const response = await eventService.getEventById(id, true);
      if (response.success && response.event) {
        setEvent(response.event);
      } else {
        Alert.alert("Error", response.message || "Failed to load event");
        router.back();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load event");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendees = async () => {
    if (!event) return;
    setLoadingUsers(true);
    try {
      const response = await eventService.getEventById(id, true);
      if (response.success && response.event) {
        setAttendees(response.event.rsvp || []);
      }
    } catch (error) {
      console.error("Error fetching attendees:", error);
    } finally {
      setLoadingUsers(false);
    }
  };
  const fetchInterestedUsers = async () => {
    if (!event) return;
    setLoadingUsers(true);
    try {
      const response = await eventService.getEventById(id, true);
      if (response.success && response.event) {
        setInterestedUsers(response.event.interested || []);
      }
    } catch (error) {
      console.error("Error fetching interested users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleInterest = async () => {
    if (!event) return;
    setProcessing(true);
    pendingUpdate.current = { type: "interest", timestamp: Date.now() };
    setEvent((prev) => {
      if (!prev) return prev;
      const currentCount = prev.interestedCount ?? 0;
      return {
        ...prev,
        isInterested: !prev.isInterested,
        interestedCount: prev.isInterested
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };
    });
    try {
      const response = await eventService.toggleInterest(event._id);
      pendingUpdate.current = null;
      if (response.success) {
        setEvent((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isInterested: response.isInterested ?? !prev.isInterested,
            interestedCount:
              response.interestedCount ?? prev.interestedCount ?? 0,
          };
        });
      } else {
        revertOptimisticUpdate("interest");
      }
    } catch (error) {
      pendingUpdate.current = null;
      revertOptimisticUpdate("interest");
      Alert.alert("Error", "Failed to update interest");
    } finally {
      setProcessing(false);
    }
  };

  const handleRsvp = async () => {
    if (!event) return;
    if (event.isFull && !event.isRsvpd) {
      Alert.alert(
        "Event Full",
        "Sorry, this event has reached its maximum capacity.",
      );
      return;
    }
    setProcessing(true);
    pendingUpdate.current = { type: "rsvp", timestamp: Date.now() };
    setEvent((prev) => {
      if (!prev) return prev;
      const currentCount = prev.rsvpCount ?? 0;
      return {
        ...prev,
        isRsvpd: !prev.isRsvpd,
        rsvpCount: prev.isRsvpd
          ? Math.max(0, currentCount - 1)
          : currentCount + 1,
      };
    });
    try {
      const response = await eventService.toggleRsvp(event._id);
      pendingUpdate.current = null;
      if (response.success) {
        setEvent((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isRsvpd: response.isRsvpd ?? !prev.isRsvpd,
            rsvpCount: response.rsvpCount ?? prev.rsvpCount ?? 0,
            isFull: response.isFull ?? prev.isFull,
          };
        });
        if (isOrganizer) {
          if (activeTab === "attendees") fetchAttendees();
          else if (activeTab === "interested") fetchInterestedUsers();
        }
      } else {
        revertOptimisticUpdate("rsvp");
      }
    } catch (error) {
      pendingUpdate.current = null;
      revertOptimisticUpdate("rsvp");
      Alert.alert("Error", "Failed to update RSVP");
    } finally {
      setProcessing(false);
    }
  };

  const revertOptimisticUpdate = (type: "interest" | "rsvp") => {
    setEvent((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isInterested:
          type === "interest" ? !prev.isInterested : prev.isInterested,
        interestedCount:
          type === "interest"
            ? prev.isInterested
              ? (prev.interestedCount ?? 0) + 1
              : Math.max(0, (prev.interestedCount ?? 0) - 1)
            : prev.interestedCount,
        isRsvpd: type === "rsvp" ? !prev.isRsvpd : prev.isRsvpd,
        rsvpCount:
          type === "rsvp"
            ? prev.isRsvpd
              ? (prev.rsvpCount ?? 0) + 1
              : Math.max(0, (prev.rsvpCount ?? 0) - 1)
            : prev.rsvpCount,
      };
    });
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out "${event.title}" on Univibe!\n\n${event.description}\n\n📍 ${event.location}\n📅 ${new Date(event.startDate).toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleEditEvent = () => {
    setShowEventOptions(false);
    if (event?._id) {
      router.push(`/events/EditEvent?id=${event._id}`);
    } else {
      Alert.alert("Error", "Event ID not found");
    }
  };

  const handleDeleteEvent = () => {
    setShowEventOptions(false);
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!event) return;
            try {
              const response = await eventService.deleteEvent(event._id);
              if (response.success) {
                Alert.alert("Success", "Event deleted successfully", [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert(
                  "Error",
                  response.message || "Failed to delete event",
                );
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete event");
            }
          },
        },
      ],
    );
  };

  const handleSaveEvent = async (eventId: string) => {
    try {
      Alert.alert("Coming Soon", "Save feature will be available soon!");
      setEvent((prev) => (prev ? { ...prev, isSaved: !prev.isSaved } : null));
    } catch (error) {
      Alert.alert("Error", "Failed to save event");
    }
  };
  const handleReportEvent = async (eventId: string) => {
    try {
      Alert.alert("Thank You", "Event has been reported. We'll review it.");
      setEvent((prev) => (prev ? { ...prev, isReported: true } : null));
    } catch (error) {
      Alert.alert("Error", "Failed to report event");
    }
  };
  const handleShareEvent = async (eventId: string) => {
    await handleShare();
  };
  const handleAddToCalendar = async (eventId: string) => {
    Alert.alert("Coming Soon", "Calendar integration will be available soon!");
  };
  const handleMuteOrganizer = async (organizerId: string) => {
    try {
      Alert.alert("Success", "Organizer muted. You won't see their events.");
    } catch (error) {
      Alert.alert("Error", "Failed to mute organizer");
    }
  };
  const handleBlockOrganizer = async (organizerId: string) => {
    Alert.alert(
      "Block Organizer",
      "Are you sure you want to block this organizer?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              Alert.alert("Success", "Organizer blocked.");
            } catch (error) {
              Alert.alert("Error", "Failed to block organizer");
            }
          },
        },
      ],
    );
  };

  const getImages = () => {
    if (event?.imageUrls && event.imageUrls.length > 0) return event.imageUrls;
    if (event?.coverImage) return [event.coverImage];
    return [];
  };

  const renderUserList = (users: User[], showOrganizerBadge = false) => (
    <FlatList
      data={users}
      renderItem={({ item }) => (
        <UserItem
          user={item}
          showOrganizerBadge={
            showOrganizerBadge && event?.organizer._id === item._id
          }
        />
      )}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.usersList}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    />
  );

  const handleOrganizerProfilePress = (organizerId: string) => {
    if (organizerId === user?.id) {
      router.push("/(tabs)/profile");
    } else {
      router.push(`/profile/${organizerId}`);
    }
  };
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const renderTabContent = () => {
    if (!event) return null;
    if (!isOrganizer) {
      return (
        <EventDetailsTab
          event={event}
          onOrganizerPress={handleOrganizerProfilePress}
        />
      );
    }
    switch (activeTab) {
      case "details":
        return (
          <EventDetailsTab
            event={event}
            onOrganizerPress={handleOrganizerProfilePress}
          />
        );
      case "attendees":
        if (loadingUsers) {
          return (
            <View style={styles.tabLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.tabLoadingText, { color: colors.textSecondary }]}
              >
                Loading attendees...
              </Text>
            </View>
          );
        }
        if (attendees.length === 0) return <EmptyState type="attendees" />;
        return renderUserList(attendees, true);
      case "interested":
        if (loadingUsers) {
          return (
            <View style={styles.tabLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.tabLoadingText, { color: colors.textSecondary }]}
              >
                Loading interested users...
              </Text>
            </View>
          );
        }
        if (interestedUsers.length === 0)
          return <EmptyState type="interested" />;
        return renderUserList(interestedUsers, false);
      default:
        return null;
    }
  };

  const images = getImages();

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!event) return null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <EventImageCarousel images={images} />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setShowEventOptions(true)}
        >
          <Ionicons name="ellipsis-vertical" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.content}>
          <View style={styles.header}>
            <View
              style={[
                styles.categoryContainer,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.category, { color: colors.primary }]}>
                {event.category}
              </Text>
            </View>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Ionicons
                name="share-outline"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {event.title}
          </Text>
          {isOrganizer && (
            <EventTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              rsvpCount={event.rsvpCount ?? 0}
              interestedCount={event.interestedCount ?? 0}
            />
          )}
          <View style={styles.tabContent}>{renderTabContent()}</View>
        </View>
      </ScrollView>
      {!isOrganizer && (
        <EventActionBar
          isInterested={event.isInterested || false}
          isRsvpd={event.isRsvpd || false}
          isFull={event.isFull || false}
          processing={processing}
          onInterest={handleInterest}
          onRsvp={handleRsvp}
        />
      )}
      <EventOptionsModal
        visible={showEventOptions}
        onClose={() => setShowEventOptions(false)}
        eventId={event._id}
        isOrganizer={isOrganizer}
        isSaved={event.isSaved || false}
        isReported={event.isReported || false}
        isInterested={event.isInterested || false}
        isRsvpd={event.isRsvpd || false}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
        onSave={handleSaveEvent}
        onReport={handleReportEvent}
        onShare={handleShareEvent}
        onAddToCalendar={handleAddToCalendar}
        onMuteOrganizer={handleMuteOrganizer}
        onBlockOrganizer={handleBlockOrganizer}
        organizerId={event.organizer._id}
        eventTitle={event.title}
        eventDate={event.startDate}
        eventLocation={event.location}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingBottom: 20 },
  backButton: {
    position: "absolute",
    top: 30,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  menuButton: {
    position: "absolute",
    top: 30,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryContainer: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  category: { fontSize: 14, fontWeight: "600", fontFamily: "SofiaSans-Bold" },
  shareButton: { padding: 8 },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    fontFamily: "SofiaSans-Bold",
    lineHeight: 34,
  },
  tabContent: { minHeight: 300 },
  tabLoadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  tabLoadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  usersList: { paddingVertical: 8 },
});
