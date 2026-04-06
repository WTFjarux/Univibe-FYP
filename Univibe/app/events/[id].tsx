// app/events/[id].tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { eventService, Event } from "@/lib/eventService";
import { useAuth } from "@/lib/AuthContext";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
  }, [id]);

  const fetchEvent = async () => {
    try {
      const response = await eventService.getEventById(id);
      if (response.success && response.event) {
        setEvent(response.event);
      } else {
        Alert.alert("Error", response.message || "Failed to load event");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching event:", error);
      Alert.alert("Error", "Failed to load event");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleInterest = async () => {
    if (!event) return;
    setProcessing(true);
    try {
      const response = await eventService.toggleInterest(event._id);
      if (response.success) {
        setEvent({
          ...event,
          isInterested: response.isInterested,
          interestedCount: response.interestedCount || 0,
        });
      }
    } catch (error) {
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
    try {
      const response = await eventService.toggleRsvp(event._id);
      if (response.success) {
        setEvent({
          ...event,
          isRsvpd: response.isRsvpd,
          rsvpCount: response.rsvpCount || 0,
          isFull: response.isFull,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update RSVP");
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out "${event?.title}" on Univibe!\n\n${event?.description}\n\n📍 ${event?.location}\n📅 ${new Date(event?.startDate || "").toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  };

  const isOrganizer = event?.organizer._id === user?.id;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    );
  }

  if (!event) return null;

  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        {event.coverImage ? (
          <Image source={{ uri: event.coverImage }} style={styles.coverImage} />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Ionicons name="calendar" size={80} color="#cbd5e1" />
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.categoryContainer}>
              <Text style={styles.category}>{event.category}</Text>
            </View>
            <TouchableOpacity onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={20} color="#8b5cf6" />
              <Text style={styles.statText}>{event.rsvpCount} attending</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="heart-outline" size={20} color="#8b5cf6" />
              <Text style={styles.statText}>
                {event.interestedCount} interested
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              <View>
                <Text style={styles.detailText}>{startDate.date}</Text>
                <Text style={styles.detailSubtext}>
                  {startDate.time} - {endDate.time}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={20} color="#6b7280" />
              <Text style={styles.detailText}>{event.location}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organizer</Text>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={20} color="#6b7280" />
              <Text style={styles.detailText}>{event.organizerName}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {event.tags && event.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {event.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {event.isOnline && event.meetingLink && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Meeting Link</Text>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => Alert.alert("Meeting Link", event.meetingLink)}
              >
                <Ionicons name="link-outline" size={20} color="#8b5cf6" />
                <Text style={styles.linkText}>Join Meeting</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {!isOrganizer && (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              event.isInterested && styles.actionButtonActive,
            ]}
            onPress={handleInterest}
            disabled={processing}
          >
            <Ionicons
              name={event.isInterested ? "heart" : "heart-outline"}
              size={22}
              color={event.isInterested ? "#ef4444" : "#6b7280"}
            />
            <Text
              style={[
                styles.actionButtonText,
                event.isInterested && styles.actionButtonTextActive,
              ]}
            >
              {event.isInterested ? "Interested" : "Mark Interest"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rsvpButton,
              event.isRsvpd && styles.rsvpButtonActive,
              event.isFull && !event.isRsvpd && styles.rsvpButtonDisabled,
            ]}
            onPress={handleRsvp}
            disabled={processing || (event.isFull && !event.isRsvpd)}
          >
            <Text
              style={[
                styles.rsvpButtonText,
                event.isRsvpd && styles.rsvpButtonTextActive,
              ]}
            >
              {event.isRsvpd
                ? "Going ✓"
                : event.isFull
                  ? "Event Full"
                  : "RSVP Now"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  coverImage: {
    width: "100%",
    height: 250,
  },
  coverPlaceholder: {
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryContainer: {
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  category: {
    color: "#8b5cf6",
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: "#6b7280",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailText: {
    fontSize: 16,
    color: "#374151",
  },
  detailSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  description: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 14,
    color: "#6b7280",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 16,
    color: "#8b5cf6",
    fontWeight: "500",
  },
  actionBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
  },
  actionButtonActive: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  actionButtonText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "500",
  },
  actionButtonTextActive: {
    color: "#ef4444",
  },
  rsvpButton: {
    flex: 2,
    backgroundColor: "#8b5cf6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  rsvpButtonActive: {
    backgroundColor: "#10b981",
  },
  rsvpButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  rsvpButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  rsvpButtonTextActive: {
    color: "white",
  },
});
