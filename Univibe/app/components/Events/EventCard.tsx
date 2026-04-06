// app/components/Events/EventCard.tsx
import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Event } from "@/lib/eventService";

const { width } = Dimensions.get("window");

interface EventCardProps {
  event: Event;
  onInterestPress?: (eventId: string) => void;
  onRsvpPress?: (eventId: string) => void;
  showActions?: boolean;
}

export default function EventCard({
  event,
  onInterestPress,
  onRsvpPress,
  showActions = true,
}: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Academic: "#dbeafe",
      Social: "#fce7f3",
      Sports: "#dcfce7",
      Career: "#fef3c7",
      Cultural: "#ede9fe",
      Workshop: "#fed7aa",
      Other: "#f3f4f6",
    };
    return colors[category] || "#f3f4f6";
  };

  const getCategoryTextColor = (category: string) => {
    const colors: Record<string, string> = {
      Academic: "#1d4ed8",
      Social: "#be185d",
      Sports: "#15803d",
      Career: "#92400e",
      Cultural: "#6d28d9",
      Workshop: "#9a3412",
      Other: "#374151",
    };
    return colors[category] || "#374151";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "#10b981";
      case "ongoing":
        return "#f59e0b";
      case "completed":
        return "#6b7280";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "upcoming":
        return "Upcoming";
      case "ongoing":
        return "In Progress";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/events/${event._id}`)}
      activeOpacity={0.7}
    >
      {/* Cover Image */}
      {event.coverImage ? (
        <Image source={{ uri: event.coverImage }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder]}>
          <Ionicons name="calendar" size={48} color="#cbd5e1" />
        </View>
      )}

      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(event.status) },
        ]}
      >
        <Text style={styles.statusText}>{getStatusText(event.status)}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(event.category) },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: getCategoryTextColor(event.category) },
              ]}
            >
              {event.category}
            </Text>
          </View>
          <View style={styles.stats}>
            <Ionicons name="people" size={14} color="#6b7280" />
            <Text style={styles.statsText}>{event.rsvpCount} going</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.details}>
          <View style={styles.detail}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{formatDate(event.startDate)}</Text>
          </View>
          <View style={styles.detail}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>

        {showActions && (
          <View style={styles.actions}>
            {/* Interested Button */}
            <TouchableOpacity
              style={[
                styles.interestedButton,
                event.isInterested && styles.interestedButtonActive,
              ]}
              onPress={() => onInterestPress?.(event._id)}
            >
              <Ionicons
                name={event.isInterested ? "heart" : "heart-outline"}
                size={16}
                color={event.isInterested ? "#ef4444" : "#8b5cf6"}
              />
              <Text
                style={[
                  styles.interestedText,
                  event.isInterested && styles.interestedTextActive,
                ]}
              >
                {event.isInterested ? "Interested" : "Interested"}
              </Text>
            </TouchableOpacity>

            {/* RSVP Button */}
            <TouchableOpacity
              style={[
                styles.rsvpButton,
                event.isRsvpd && styles.rsvpButtonActive,
              ]}
              onPress={() => onRsvpPress?.(event._id)}
            >
              <Text
                style={[
                  styles.rsvpText,
                  event.isRsvpd && styles.rsvpTextActive,
                ]}
              >
                {event.isRsvpd ? "Going ✓" : "RSVP"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  coverImage: {
    width: width - 40,
    height: 160,
    backgroundColor: "#f3f4f6",
  },
  coverPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    fontWeight: "600",
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statsText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
    marginBottom: 12,
  },
  details: {
    gap: 8,
    marginBottom: 16,
  },
  detail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  interestedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flex: 1,
  },
  interestedButtonActive: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  interestedText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  interestedTextActive: {
    color: "#ef4444",
  },
  rsvpButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  rsvpButtonActive: {
    backgroundColor: "#10b981",
  },
  rsvpText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  rsvpTextActive: {
    color: "white",
  },
});
