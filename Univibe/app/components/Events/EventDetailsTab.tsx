// app/components/Events/EventDetailsTab.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ImageSourcePropType,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Event } from "@/lib/services/eventService";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../../constants/ipConstants";
import socketService from "@/lib/services/socketService";

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../assets/images/default-avatar.png");

interface EventDetailsTabProps {
  event: Event;
  onOrganizerPress?: (organizerId: string) => void;
}

export const EventDetailsTab = ({
  event,
  onOrganizerPress,
}: EventDetailsTabProps) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // LOCAL STATE for real-time counts
  const [localRsvpCount, setLocalRsvpCount] = useState(event.rsvpCount ?? 0);
  const [localInterestedCount, setLocalInterestedCount] = useState(
    event.interestedCount ?? 0,
  );

  // Sync with event prop changes
  useEffect(() => {
    setLocalRsvpCount(event.rsvpCount ?? 0);
    setLocalInterestedCount(event.interestedCount ?? 0);
  }, [event.rsvpCount, event.interestedCount]);

  // Listen for socket updates
  useEffect(() => {
    if (!event._id) return;

    const handleEventUpdate = (data: any) => {
      if (data.eventId === event._id) {
        if (data.rsvpCount !== undefined) {
          setLocalRsvpCount(data.rsvpCount ?? 0);
        }
        if (data.interestedCount !== undefined) {
          setLocalInterestedCount(data.interestedCount ?? 0);
        }
      }
    };

    socketService.on("event:updated", handleEventUpdate);

    return () => {
      socketService.off("event:updated", handleEventUpdate);
    };
  }, [event._id]);

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

  const startDate = formatDate(event.startDate);
  const endDate = formatDate(event.endDate);

  const handleOrganizerPress = useCallback(() => {
    if (onOrganizerPress) {
      onOrganizerPress(event.organizer._id);
    } else {
      router.push(`/profile/${event.organizer._id}`);
    }
  }, [event.organizer._id, onOrganizerPress]);

  const getFullImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const getProfileImage = () => {
    const profilePic = event.organizer.profilePicture;
    if (profilePic && profilePic !== "" && !imageError) {
      const fullUrl = getFullImageUrl(profilePic);
      if (fullUrl) {
        return { uri: fullUrl };
      }
    }
    return DEFAULT_AVATAR;
  };

  const profileImage = getProfileImage();

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  return (
    <View style={styles.detailsTab}>
      <View style={styles.statsContainer}>
        <View style={styles.stat}>
          <Ionicons name="people-outline" size={18} color="#8b5cf6" />
          <Text style={styles.statText}>{localRsvpCount} attending</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={18} color="#8b5cf6" />
          <Text style={styles.statText}>{localInterestedCount} interested</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date & Time</Text>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={20} color="#6b7280" />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailText}>{startDate.date}</Text>
            <Text style={styles.detailSubtext}>
              {startDate.time} - {endDate.time}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationContainer}>
          <View style={styles.locationIconWrapper}>
            <Ionicons name="location-outline" size={20} color="#8b5cf6" />
          </View>
          <View style={styles.locationTextContainer}>
            <Text style={styles.locationText}>{event.location}</Text>
            <TouchableOpacity style={styles.getDirectionsButton}>
              <Text style={styles.getDirectionsText}>Get Directions</Text>
              <Ionicons name="arrow-forward" size={14} color="#8b5cf6" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Organizer</Text>
        <TouchableOpacity
          style={styles.organizerContainer}
          onPress={handleOrganizerPress}
          activeOpacity={0.7}
        >
          <View style={styles.organizerAvatar}>
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#8b5cf6" />
              </View>
            )}
            <Image
              source={profileImage}
              style={styles.organizerAvatarImage}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </View>
          <View style={styles.organizerInfo}>
            <Text style={styles.organizerName}>
              {(event.organizer as any).fullName || event.organizerName}
            </Text>
            <Text style={styles.organizerUsername}>
              @
              {event.organizer.username ||
                (event.organizer as any).fullName
                  ?.toLowerCase()
                  .replace(/\s/g, "") ||
                event.organizerName.toLowerCase().replace(/\s/g, "")}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
        </TouchableOpacity>
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
  );
};

const styles = StyleSheet.create({
  detailsTab: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 14,
    fontFamily: "SofiaSans-Bold",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailText: {
    fontSize: 16,
    color: "#374151",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 22,
  },
  detailSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  locationIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
  },
  locationTextContainer: {
    flex: 1,
    gap: 8,
  },
  locationText: {
    fontSize: 16,
    color: "#374151",
    fontFamily: "SofiaSans-Regular",
    lineHeight: 22,
  },
  getDirectionsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  getDirectionsText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Bold",
  },
  organizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  organizerAvatar: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3e8ff",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  organizerAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(243, 232, 255, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  organizerInfo: {
    flex: 1,
  },
  organizerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
  },
  organizerUsername: {
    fontSize: 13,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  description: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 26,
    fontFamily: "SofiaSans-Regular",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f3e8ff",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 16,
    color: "#8b5cf6",
    fontWeight: "500",
    fontFamily: "SofiaSans-Bold",
  },
});

export default EventDetailsTab;
