// app/components/Events/EventCard.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/lib/contexts/ThemeContext";
import {
  Event,
  eventService,
  getFullImageUrl,
} from "@/lib/services/eventService";

const { width } = Dimensions.get("window");

interface EventCardProps {
  event: Event;
  onInterestPress?: (eventId: string) => void;
  onRsvpPress?: (eventId: string) => void;
  showActions?: boolean;
  currentUserId?: string;
}

export default function EventCard({
  event,
  onInterestPress,
  onRsvpPress,
  showActions = true,
  currentUserId,
}: EventCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<Event["status"]>(
    event.status,
  );
  const flatListRef = useRef<FlatList>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { colors } = useTheme();

  // Check if event belongs to a community
  const hasCommunity =
    event.community &&
    typeof event.community === "object" &&
    "name" in event.community;

  useEffect(() => {
    const checkAndUpdateStatus = () => {
      const now = new Date();
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      let newStatus = currentStatus;
      if (currentStatus !== "cancelled") {
        if (endDate < now && currentStatus !== "completed")
          newStatus = "completed";
        else if (
          startDate <= now &&
          endDate >= now &&
          currentStatus === "upcoming"
        )
          newStatus = "ongoing";
      }
      if (newStatus !== currentStatus) {
        setCurrentStatus(newStatus);
        eventService.refreshEventStatus(event._id).catch(() => {});
      }
    };
    checkAndUpdateStatus();
    statusIntervalRef.current = setInterval(checkAndUpdateStatus, 30000);
    return () => {
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, [event._id, event.startDate, event.endDate]);

  const isOrganizer = (() => {
    if (!currentUserId) return false;
    if (typeof event.organizer === "string")
      return event.organizer === currentUserId;
    if (event.organizer && typeof event.organizer === "object")
      return event.organizer._id === currentUserId;
    return false;
  })();

  const formatDateShort = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const isSameDay = (d1: string, d2: string) =>
    new Date(d1).toDateString() === new Date(d2).toDateString();

  const getCategoryColor = (category: string) => {
    const c: Record<string, string> = {
      Academic: "#dbeafe",
      Social: "#fce7f3",
      Sports: "#dcfce7",
      Career: "#fef3c7",
      Cultural: "#ede9fe",
      Workshop: "#fed7aa",
      Other: "#f3f4f6",
    };
    return c[category] || "#f3f4f6";
  };
  const getCategoryTextColor = (category: string) => {
    const c: Record<string, string> = {
      Academic: "#1d4ed8",
      Social: "#be185d",
      Sports: "#15803d",
      Career: "#92400e",
      Cultural: "#6d28d9",
      Workshop: "#9a3412",
      Other: "#374151",
    };
    return c[category] || "#374151";
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

  const getVisibilityDisplayName = (visibility: string) => {
    const names: Record<string, string> = {
      campus: "Campus",
      connections: "Connections",
      public: "Public",
      community: "Community",
    };
    return names[visibility] || visibility || "Campus";
  };

  const getVisibilityBadgeColor = (visibility: string) => {
    const colors: Record<string, string> = {
      campus: "#3b82f6",
      connections: "#8b5cf6",
      public: "#10b981",
      community: "#7c3aed",
    };
    return colors[visibility] || "#9ca3af";
  };

  const getEventImages = () => {
    if (event.imageUrls && event.imageUrls.length > 0) return event.imageUrls;
    if (event.coverImage) return [event.coverImage];
    return [];
  };
  const images = getEventImages();
  const hasMultipleImages = images.length > 1;
  const safeRsvpCount = event.rsvpCount ?? 0;
  const sameDay = isSameDay(event.startDate, event.endDate);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentImageIndex(viewableItems[0].index);
      }
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const renderImageItem = ({ item: imageUrl }: { item: string }) => (
    <Image
      source={{ uri: imageUrl }}
      style={[styles.coverImage, { backgroundColor: colors.skeleton }]}
    />
  );

  const isEventInteractable =
    currentStatus !== "completed" && currentStatus !== "cancelled";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.card, shadowColor: colors.shadow },
        currentStatus === "completed" && styles.cardCompleted,
        currentStatus === "cancelled" && styles.cardCancelled,
      ]}
      onPress={() => router.push(`/events/${event._id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {images.length > 0 ? (
          <>
            <FlatList
              ref={flatListRef}
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => `${event._id}_image_${index}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              style={styles.carousel}
            />

            {currentStatus === "completed" && (
              <View style={styles.completedOverlay}>
                <Ionicons name="checkmark-circle" size={48} color="#fff" />
                <Text style={styles.overlayText}>Completed</Text>
              </View>
            )}
            {currentStatus === "cancelled" && (
              <View style={styles.cancelledOverlay}>
                <Ionicons name="close-circle" size={48} color="#fff" />
                <Text style={styles.overlayText}>Cancelled</Text>
              </View>
            )}
          </>
        ) : (
          <View
            style={[
              styles.coverImage,
              styles.coverPlaceholder,
              { backgroundColor: colors.skeleton },
            ]}
          >
            <Ionicons name="calendar" size={48} color={colors.textMuted} />
          </View>
        )}
      </View>

      {/* Status Badge - Right side */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(currentStatus) },
        ]}
      >
        <Text style={styles.statusText}>{getStatusText(currentStatus)}</Text>
      </View>

      {/* ✅ Visibility Badge - Left side (shows Campus/Community/Public/Connections) */}
      <View style={styles.visibilityBadge}>
        <Ionicons
          name={
            event.visibility === "community"
              ? "people"
              : event.visibility === "connections"
                ? "people-outline"
                : event.visibility === "public"
                  ? "globe-outline"
                  : "school-outline"
          }
          size={12}
          color="#fff"
        />
        <Text style={styles.visibilityBadgeText}>
          {getVisibilityDisplayName(event.visibility)}
        </Text>
      </View>

      {/* Approval Badge - Below visibility if pending/rejected */}
      {isOrganizer &&
        event.approvalStatus &&
        event.approvalStatus !== "approved" && (
          <View
            style={[
              styles.approvalBadge,
              {
                backgroundColor:
                  event.approvalStatus === "pending" ? "#fef3c7" : "#fee2e2",
              },
            ]}
          >
            <Ionicons
              name={
                event.approvalStatus === "pending"
                  ? "time-outline"
                  : "close-circle-outline"
              }
              size={12}
              color={event.approvalStatus === "pending" ? "#92400e" : "#991b1b"}
            />
            <Text
              style={[
                styles.approvalBadgeText,
                {
                  color:
                    event.approvalStatus === "pending" ? "#92400e" : "#991b1b",
                },
              ]}
            >
              {event.approvalStatus === "pending"
                ? "Pending Approval"
                : "Rejected"}
            </Text>
          </View>
        )}

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
            <Ionicons name="people" size={14} color={colors.textSecondary} />
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>
              {safeRsvpCount} going
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.details}>
          <View style={styles.detail}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.textSecondary}
            />
            {sameDay ? (
              <View style={styles.sameDayContainer}>
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {formatDateShort(event.startDate)}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={colors.textMuted}
                />
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {new Date(event.endDate).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>
            ) : (
              <View style={styles.multiDayContainer}>
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {formatDateShort(event.startDate)}
                </Text>
                <Text
                  style={[
                    styles.detailTextSecondary,
                    { color: colors.textMuted },
                  ]}
                >
                  to
                </Text>
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {formatDateShort(event.endDate)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.detail}>
            <Ionicons
              name="location-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.detailText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {event.location}
            </Text>
          </View>
        </View>

        {event.isFeatured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.featuredText}>Featured Event</Text>
          </View>
        )}

        {/* ✅ Community Event Info OR Organizer Info */}
        {hasCommunity ? (
          <View style={styles.communityInfoContainer}>
            {event.community &&
            typeof event.community === "object" &&
            event.community.coverImage ? (
              <Image
                source={{ uri: getFullImageUrl(event.community.coverImage) }}
                style={styles.communityAvatar}
              />
            ) : (
              <View
                style={[
                  styles.communityAvatar,
                  styles.communityAvatarPlaceholder,
                ]}
              >
                <Ionicons name="people" size={16} color="#7c3aed" />
              </View>
            )}
            <View style={styles.communityTextContainer}>
              <Text style={[styles.communityName, { color: colors.text }]}>
                {event.community && typeof event.community === "object"
                  ? event.community.name
                  : "Community"}
              </Text>
              <Text
                style={[styles.communityLabel, { color: colors.textSecondary }]}
              >
                Community Event
              </Text>
            </View>
          </View>
        ) : isOrganizer ? (
          <View style={styles.organizerBadge}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.organizerBadgeText}>You're the organizer</Text>
          </View>
        ) : (
          <View style={styles.organizerInfo}>
            <Ionicons
              name="person-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.organizerText, { color: colors.textSecondary }]}
            >
              Organized by{" "}
              {event.organizerName ||
                (typeof event.organizer === "object"
                  ? event.organizer?.name
                  : "Organizer")}
            </Text>
          </View>
        )}

        {showActions && !isOrganizer && isEventInteractable && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.interestedButton,
                { borderColor: colors.border },
                event.isInterested && styles.interestedButtonActive,
              ]}
              onPress={() => onInterestPress?.(event._id)}
            >
              <Ionicons
                name={event.isInterested ? "heart" : "heart-outline"}
                size={16}
                color={event.isInterested ? "#ef4444" : colors.primary}
              />
              <Text
                style={[
                  styles.interestedText,
                  { color: colors.primary },
                  event.isInterested && styles.interestedTextActive,
                ]}
              >
                Interested
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.rsvpButton,
                { backgroundColor: colors.primary },
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
        {showActions && !isOrganizer && !isEventInteractable && (
          <View
            style={[
              styles.eventEndedMessage,
              { backgroundColor: colors.skeleton },
            ]}
          >
            <Ionicons
              name={
                currentStatus === "completed"
                  ? "checkmark-circle"
                  : "close-circle"
              }
              size={16}
              color={currentStatus === "completed" ? "#10b981" : "#ef4444"}
            />
            <Text
              style={[
                styles.eventEndedText,
                {
                  color: currentStatus === "completed" ? "#10b981" : "#ef4444",
                },
              ]}
            >
              This event has{" "}
              {currentStatus === "completed" ? "ended" : "been cancelled"}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompleted: { opacity: 0.8 },
  cardCancelled: { opacity: 0.7 },
  imageContainer: { position: "relative", width: width - 40, height: 200 },
  carousel: { flex: 1 },
  coverImage: { width: width - 40, height: 200 },
  coverPlaceholder: { justifyContent: "center", alignItems: "center" },
  completedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  cancelledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(239, 68, 68, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  overlayText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  statusText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
  },
  // ✅ Visibility Badge (replaces community badge)
  visibilityBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  visibilityBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
    color: "#fff",
  },
  approvalBadge: {
    position: "absolute",
    top: 44,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  approvalBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
  },
  navButton: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -20 }],
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
    zIndex: 10,
  },
  navButtonLeft: { left: 12 },
  navButtonRight: { right: 12 },
  dotsContainer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  imageCounter: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    zIndex: 10,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
  },
  content: { padding: 16 },
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
  stats: { flexDirection: "row", alignItems: "center", gap: 4 },
  statsText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
  },
  details: { gap: 8, marginBottom: 12 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: { fontSize: 14, fontFamily: "SofiaSans-Regular" },
  detailTextSecondary: { fontSize: 13, fontFamily: "SofiaSans-Regular" },
  sameDayContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  multiDayContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    flexWrap: "wrap",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  featuredText: {
    fontSize: 12,
    color: "#92400e",
    fontFamily: "SofiaSans-Regular",
    fontWeight: "500",
  },
  communityInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  communityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  communityAvatarPlaceholder: {
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
  },
  communityTextContainer: {
    flex: 1,
  },
  communityName: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  communityLabel: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    marginTop: 1,
  },
  organizerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  organizerBadgeText: {
    fontSize: 11,
    color: "#92400e",
    fontFamily: "SofiaSans-Regular",
    fontWeight: "500",
  },
  organizerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  organizerText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
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
    flex: 1,
  },
  interestedButtonActive: {
    backgroundColor: "#fee2e2",
    borderColor: "#ef4444",
  },
  interestedText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  interestedTextActive: { color: "#ef4444" },
  rsvpButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  rsvpButtonActive: { backgroundColor: "#10b981" },
  rsvpText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  rsvpTextActive: { color: "white" },
  eventEndedMessage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
  },
  eventEndedText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
});
