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
import { useTheme } from "@/lib/contexts/ThemeContext";
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
  const { colors, isDark } = useTheme();
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [localRsvpCount, setLocalRsvpCount] = useState(event.rsvpCount ?? 0);
  const [localInterestedCount, setLocalInterestedCount] = useState(
    event.interestedCount ?? 0,
  );

  // ✅ Check if event belongs to a community
  const hasCommunity =
    event.community &&
    typeof event.community === "object" &&
    "name" in event.community;

  useEffect(() => {
    setLocalRsvpCount(event.rsvpCount ?? 0);
    setLocalInterestedCount(event.interestedCount ?? 0);
  }, [event.rsvpCount, event.interestedCount]);

  useEffect(() => {
    if (!event._id) return;
    const handleEventUpdate = (data: any) => {
      if (data.eventId === event._id) {
        if (data.rsvpCount !== undefined)
          setLocalRsvpCount(data.rsvpCount ?? 0);
        if (data.interestedCount !== undefined)
          setLocalInterestedCount(data.interestedCount ?? 0);
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

  // ✅ Handle community press - navigate to community screen
  const handleCommunityPress = useCallback(() => {
    if (
      hasCommunity &&
      event.community &&
      typeof event.community === "object"
    ) {
      router.push({
        pathname: "/screens/CommunityScreen",
        params: { communityId: event.community._id },
      });
    }
  }, [hasCommunity, event.community]);

  const getFullImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const getProfileImage = () => {
    const profilePic = event.organizer.profilePicture;
    if (profilePic && profilePic !== "" && !imageError) {
      const fullUrl = getFullImageUrl(profilePic);
      if (fullUrl) return { uri: fullUrl };
    }
    return DEFAULT_AVATAR;
  };

  const getCommunityCoverImage = () => {
    if (
      hasCommunity &&
      event.community &&
      typeof event.community === "object" &&
      event.community.coverImage
    ) {
      const fullUrl = getFullImageUrl(event.community.coverImage);
      if (fullUrl) return { uri: fullUrl };
    }
    return null;
  };

  const profileImage = getProfileImage();
  const communityCoverImage = getCommunityCoverImage();

  const handleImageLoad = () => {
    setIsLoading(false);
  };
  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  return (
    <View style={styles.detailsTab}>
      <View
        style={[styles.statsContainer, { borderBottomColor: colors.border }]}
      >
        <View style={styles.stat}>
          <Ionicons name="people-outline" size={18} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {localRsvpCount} attending
          </Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={18} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.textSecondary }]}>
            {localInterestedCount} interested
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Date & Time
        </Text>
        <View style={styles.detailItem}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.detailTextContainer}>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {startDate.date}
            </Text>
            <Text
              style={[styles.detailSubtext, { color: colors.textSecondary }]}
            >
              {startDate.time} - {endDate.time}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Location
        </Text>
        <View style={styles.locationContainer}>
          <View
            style={[
              styles.locationIconWrapper,
              {
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.2)"
                  : "#f3e8ff",
              },
            ]}
          >
            <Ionicons
              name="location-outline"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.locationTextContainer}>
            <Text style={[styles.locationText, { color: colors.text }]}>
              {event.location}
            </Text>
            <TouchableOpacity style={styles.getDirectionsButton}>
              <Text
                style={[styles.getDirectionsText, { color: colors.primary }]}
              >
                Get Directions
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ✅ COMMUNITY EVENT - Show Community as Organizer */}
      {hasCommunity ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Organizer
          </Text>
          <TouchableOpacity
            style={[
              styles.communityOrganizerContainer,
              {
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.15)"
                  : "#f5f3ff",
                borderColor: isDark ? "rgba(167, 139, 250, 0.3)" : "#ede9fe",
              },
            ]}
            onPress={handleCommunityPress}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.communityOrganizerAvatar,
                {
                  backgroundColor: isDark
                    ? "rgba(167, 139, 250, 0.3)"
                    : "#ede9fe",
                },
              ]}
            >
              {communityCoverImage ? (
                <Image
                  source={communityCoverImage}
                  style={styles.communityOrganizerAvatarImage}
                />
              ) : (
                <Ionicons name="people" size={26} color="#7c3aed" />
              )}
            </View>
            <View style={styles.organizerInfo}>
              <Text style={[styles.organizerName, { color: colors.text }]}>
                {hasCommunity &&
                event.community &&
                typeof event.community === "object"
                  ? event.community.name
                  : "Community"}
              </Text>
              <Text
                style={[
                  styles.organizerUsername,
                  { color: colors.textSecondary },
                ]}
              >
                Community Event
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      ) : (
        /* REGULAR EVENT - Show individual Organizer */
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Organizer
          </Text>
          <TouchableOpacity
            style={styles.organizerContainer}
            onPress={handleOrganizerPress}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.organizerAvatar,
                {
                  backgroundColor: isDark
                    ? "rgba(167, 139, 250, 0.2)"
                    : "#f3e8ff",
                },
              ]}
            >
              {isLoading && (
                <View
                  style={[
                    styles.loadingOverlay,
                    {
                      backgroundColor: isDark
                        ? "rgba(30, 30, 30, 0.8)"
                        : "rgba(243, 232, 255, 0.8)",
                    },
                  ]}
                >
                  <ActivityIndicator size="small" color={colors.primary} />
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
              <Text style={[styles.organizerName, { color: colors.text }]}>
                {(event.organizer as any).fullName || event.organizerName}
              </Text>
              <Text
                style={[
                  styles.organizerUsername,
                  { color: colors.textSecondary },
                ]}
              >
                @
                {event.organizer.username ||
                  (event.organizer as any).fullName
                    ?.toLowerCase()
                    .replace(/\s/g, "") ||
                  event.organizerName.toLowerCase().replace(/\s/g, "")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Description
        </Text>
        <Text style={[styles.description, { color: colors.text }]}>
          {event.description}
        </Text>
      </View>

      {event.tags && event.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Tags
          </Text>
          <View style={styles.tagsContainer}>
            {event.tags.map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: colors.skeleton }]}
              >
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                  #{tag}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {event.isOnline && event.meetingLink && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Meeting Link
          </Text>
          <TouchableOpacity
            style={[
              styles.linkButton,
              {
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.2)"
                  : "#f3e8ff",
              },
            ]}
            onPress={() => Alert.alert("Meeting Link", event.meetingLink)}
          >
            <Ionicons name="link-outline" size={20} color={colors.primary} />
            <Text style={[styles.linkText, { color: colors.primary }]}>
              Join Meeting
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  detailsTab: { flex: 1 },
  statsContainer: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 8 },
  statText: { fontSize: 14, fontFamily: "SofiaSans-Regular" },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 14,
    fontFamily: "SofiaSans-Bold",
  },
  // ✅ Community Organizer Styles
  communityOrganizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  communityOrganizerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  communityOrganizerAvatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  detailItem: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailTextContainer: { flex: 1 },
  detailText: { fontSize: 16, fontFamily: "SofiaSans-Regular", lineHeight: 22 },
  detailSubtext: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  locationIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  locationTextContainer: { flex: 1, gap: 8 },
  locationText: {
    fontSize: 16,
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
  getDirectionsText: { fontSize: 14, fontFamily: "SofiaSans-Bold" },
  // Organizer styles (for regular events)
  organizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  organizerAvatar: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  organizerAvatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  organizerInfo: { flex: 1 },
  organizerName: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 2,
  },
  organizerUsername: { fontSize: 13, fontFamily: "SofiaSans-Regular" },
  description: {
    fontSize: 16,
    lineHeight: 26,
    fontFamily: "SofiaSans-Regular",
  },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tag: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tagText: { fontSize: 14, fontFamily: "SofiaSans-Regular" },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  linkText: { fontSize: 16, fontWeight: "500", fontFamily: "SofiaSans-Bold" },
});

export default EventDetailsTab;
