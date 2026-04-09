// app/components/Events/EventCard.tsx
import React, { useState, useRef } from "react";
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
import { Event } from "@/lib/eventService";

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
  const flatListRef = useRef<FlatList>(null);

  // Check if current user is the organizer
  const isOrganizer = (() => {
    if (!currentUserId) return false;

    // Case 1: organizer is a string ID
    if (typeof event.organizer === "string") {
      return event.organizer === currentUserId;
    }

    // Case 2: organizer is an object with _id property
    if (event.organizer && typeof event.organizer === "object") {
      return event.organizer._id === currentUserId;
    }

    return false;
  })();

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

  // Get images array from event
  const getEventImages = () => {
    if (event.imageUrls && event.imageUrls.length > 0) {
      return event.imageUrls;
    }
    if (event.coverImage) {
      return [event.coverImage];
    }
    return [];
  };

  const images = getEventImages();
  const hasMultipleImages = images.length > 1;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentImageIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderImageItem = ({
    item: imageUrl,
  }: {
    item: string;
    index: number;
  }) => <Image source={{ uri: imageUrl }} style={styles.coverImage} />;

  const renderDot = () => {
    if (!hasMultipleImages) return null;

    return (
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
    );
  };

  const renderNavigationButtons = () => {
    if (!hasMultipleImages) return null;

    return (
      <>
        {currentImageIndex > 0 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonLeft]}
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index: currentImageIndex - 1,
                animated: true,
              });
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        {currentImageIndex < images.length - 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonRight]}
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index: currentImageIndex + 1,
                animated: true,
              });
            }}
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </>
    );
  };

  const renderImageCounter = () => {
    if (!hasMultipleImages) return null;

    return (
      <View style={styles.imageCounter}>
        <Ionicons name="images-outline" size={12} color="#fff" />
        <Text style={styles.imageCounterText}>
          {currentImageIndex + 1}/{images.length}
        </Text>
      </View>
    );
  };

  // Render organizer badge for your own events
  const renderOrganizerBadge = () => {
    if (!isOrganizer) return null;

    return (
      <View style={styles.organizerBadge}>
        <Ionicons name="star" size={12} color="#f59e0b" />
        <Text style={styles.organizerBadgeText}>You're the organizer</Text>
      </View>
    );
  };

  // Render organizer name for other events
  const renderOrganizerName = () => {
    if (isOrganizer) return null;

    const organizerDisplayName =
      event.organizerName ||
      (typeof event.organizer === "object"
        ? event.organizer?.name
        : "Organizer");

    return (
      <View style={styles.organizerInfo}>
        <Ionicons name="person-outline" size={14} color="#6b7280" />
        <Text style={styles.organizerText}>
          Organized by {organizerDisplayName}
        </Text>
      </View>
    );
  };

  return (
    <TouchableOpacity
      style={styles.card}
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
            {renderImageCounter()}
            {renderNavigationButtons()}
            {renderDot()}
          </>
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Ionicons name="calendar" size={48} color="#cbd5e1" />
          </View>
        )}
      </View>

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

        {/* Show organizer badge for own events OR organizer name for other events */}
        {renderOrganizerBadge()}
        {renderOrganizerName()}

        {/* Image Count Indicator */}
        {hasMultipleImages && (
          <View style={styles.imageInfo}>
            <Ionicons name="images-outline" size={14} color="#9ca3af" />
            <Text style={styles.imageInfoText}>{images.length} photos</Text>
          </View>
        )}

        {/* Actions - Only show if showActions is true AND user is NOT the organizer */}
        {showActions && !isOrganizer && (
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
  imageContainer: {
    position: "relative",
    width: width - 40,
    height: 200,
  },
  carousel: {
    flex: 1,
  },
  coverImage: {
    width: width - 40,
    height: 200,
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
    zIndex: 10,
  },
  statusText: {
    color: "white",
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
  navButtonLeft: {
    left: 12,
  },
  navButtonRight: {
    right: 12,
  },
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
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
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
    marginBottom: 12,
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
    marginBottom: 12,
  },
  organizerText: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  imageInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 4,
  },
  imageInfoText: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
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
