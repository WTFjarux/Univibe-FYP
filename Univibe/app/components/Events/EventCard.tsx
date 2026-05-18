// app/components/Events/EventCard.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
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
import { Event, eventService } from "@/lib/services/eventService";

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

  // Update status based on current time
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

  // Check if current user is the organizer
  const isOrganizer = (() => {
    if (!currentUserId) return false;
    if (typeof event.organizer === "string")
      return event.organizer === currentUserId;
    if (event.organizer && typeof event.organizer === "object")
      return event.organizer._id === currentUserId;
    return false;
  })();

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const isSameDay = (d1: string, d2: string) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.toDateString() === date2.toDateString();
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
    <Image source={{ uri: imageUrl }} style={styles.coverImage} />
  );

  const isEventInteractable =
    currentStatus !== "completed" && currentStatus !== "cancelled";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        currentStatus === "completed" && styles.cardCompleted,
        currentStatus === "cancelled" && styles.cardCancelled,
      ]}
      onPress={() => router.push(`/events/${event._id}`)}
      activeOpacity={0.7}
    >
      {/* Image Carousel */}
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
            {hasMultipleImages && (
              <>
                <View style={styles.imageCounter}>
                  <Ionicons name="images-outline" size={12} color="#fff" />
                  <Text style={styles.imageCounterText}>
                    {currentImageIndex + 1}/{images.length}
                  </Text>
                </View>
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.navButton, styles.navButtonLeft]}
                    onPress={() =>
                      flatListRef.current?.scrollToIndex({
                        index: currentImageIndex - 1,
                        animated: true,
                      })
                    }
                  >
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                {currentImageIndex < images.length - 1 && (
                  <TouchableOpacity
                    style={[styles.navButton, styles.navButtonRight]}
                    onPress={() =>
                      flatListRef.current?.scrollToIndex({
                        index: currentImageIndex + 1,
                        animated: true,
                      })
                    }
                  >
                    <Ionicons name="chevron-forward" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
                <View style={styles.dotsContainer}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        currentImageIndex === index && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            )}
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
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Ionicons name="calendar" size={48} color="#cbd5e1" />
          </View>
        )}
      </View>

      {/* Status Badge - Top Right */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(currentStatus) },
        ]}
      >
        <Text style={styles.statusText}>{getStatusText(currentStatus)}</Text>
      </View>

      {/* Approval Badge - Top Left (only for organizer) */}
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
            <Text style={styles.statsText}>{safeRsvpCount} going</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        {/* Date & Time Display */}
        <View style={styles.details}>
          <View style={styles.detail}>
            <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            {sameDay ? (
              <View style={styles.sameDayContainer}>
                <Text style={styles.detailText}>
                  {formatDateShort(event.startDate)}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#9ca3af" />
                <Text style={styles.detailText}>
                  {new Date(event.endDate).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </View>
            ) : (
              <View style={styles.multiDayContainer}>
                <Text style={styles.detailText}>
                  {formatDateShort(event.startDate)}
                </Text>
                <Text style={styles.detailTextSecondary}>to</Text>
                <Text style={styles.detailText}>
                  {formatDateShort(event.endDate)}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.detail}>
            <Ionicons name="location-outline" size={16} color="#6b7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        </View>

        {/* Featured Badge */}
        {event.isFeatured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.featuredText}>Featured Event</Text>
          </View>
        )}

        {/* Organizer Info */}
        {isOrganizer ? (
          <View style={styles.organizerBadge}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.organizerBadgeText}>You're the organizer</Text>
          </View>
        ) : (
          <View style={styles.organizerInfo}>
            <Ionicons name="person-outline" size={14} color="#6b7280" />
            <Text style={styles.organizerText}>
              Organized by{" "}
              {event.organizerName ||
                (typeof event.organizer === "object"
                  ? event.organizer?.name
                  : "Organizer")}
            </Text>
          </View>
        )}

        {/* Actions */}
        {showActions && !isOrganizer && isEventInteractable && (
          <View style={styles.actions}>
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
        {showActions && !isOrganizer && !isEventInteractable && (
          <View style={styles.eventEndedMessage}>
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
  cardCompleted: { opacity: 0.8 },
  cardCancelled: { opacity: 0.7 },
  imageContainer: { position: "relative", width: width - 40, height: 200 },
  carousel: { flex: 1 },
  coverImage: { width: width - 40, height: 200, backgroundColor: "#f3f4f6" },
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
  approvalBadge: {
    position: "absolute",
    top: 12,
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
  details: { gap: 8, marginBottom: 12 },
  detail: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
  },
  detailTextSecondary: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#9ca3af",
  },
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
  organizerText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
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
  interestedTextActive: { color: "#ef4444" },
  rsvpButton: {
    backgroundColor: "#8b5cf6",
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
    backgroundColor: "#f9fafb",
    borderRadius: 20,
  },
  eventEndedText: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
});
