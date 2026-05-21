import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { EventSearchResult as EventSearchResultType } from "../../../lib/types/search";
import { formatTimeAgo } from "../../../lib/utils/formatTime";

interface EventSearchResultProps {
  event: EventSearchResultType;
}

const formatEventDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `${diffDays} days away`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case "upcoming":
      return { label: "Upcoming", color: "#3b82f6", bgColor: "#eff6ff" };
    case "ongoing":
      return { label: "Ongoing", color: "#10b981", bgColor: "#f0fdf4" };
    case "completed":
      return { label: "Completed", color: "#6b7280", bgColor: "#f3f4f6" };
    case "cancelled":
      return { label: "Cancelled", color: "#ef4444", bgColor: "#fef2f2" };
    default:
      return { label: status, color: "#6b7280", bgColor: "#f3f4f6" };
  }
};

export const EventSearchResult: React.FC<EventSearchResultProps> = ({
  event,
}) => {
  const router = useRouter();
  const { colors } = useTheme();
  const statusConfig = getStatusConfig(event.status);
  const [imageError, setImageError] = React.useState(false);

  const handlePress = () => {
    router.push({ pathname: "/events/[id]", params: { id: event._id } });
  };
  const handleOrganizerPress = (e: any) => {
    e.stopPropagation();
    if (event.organizer?._id) {
      router.push(`/profile/${event.organizer._id}`);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: colors.card, shadowColor: colors.shadow },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {event.coverImage && !imageError ? (
        <Image
          source={{ uri: event.coverImage }}
          style={[styles.coverImage, { backgroundColor: colors.skeleton }]}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.coverImage,
            styles.coverPlaceholder,
            { backgroundColor: colors.skeleton },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={32}
            color={colors.textMuted}
          />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={2}
          >
            {event.title}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusConfig.bgColor },
            ]}
          >
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {formatEventDate(event.startDate)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons
              name="location-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.infoText, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {event.isOnline ? "Online" : event.location}
            </Text>
          </View>
        </View>
        <View style={styles.bottomRow}>
          <View
            style={[styles.categoryBadge, { backgroundColor: colors.skeleton }]}
          >
            <Text
              style={[styles.categoryText, { color: colors.textSecondary }]}
            >
              {event.category}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons
                name="people-outline"
                size={12}
                color={colors.textMuted}
              />
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {event.rsvpCount}
              </Text>
            </View>
            {event.maxAttendees && (
              <Text style={[styles.statDivider, { color: colors.textMuted }]}>
                /
              </Text>
            )}
            {event.maxAttendees && (
              <Text style={[styles.statText, { color: colors.textMuted }]}>
                {event.maxAttendees}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleOrganizerPress}
            style={styles.organizerRow}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text
              style={[styles.organizerText, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              by {event.organizerName || event.organizer?.name || "Unknown"}
            </Text>
          </TouchableOpacity>
        </View>
        {event.isFull && (
          <View style={styles.fullBadge}>
            <Ionicons name="lock-closed-outline" size={10} color="#ef4444" />
            <Text style={styles.fullText}>Full</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
    borderBottomWidth: 0,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  coverImage: { width: 72, height: 72, borderRadius: 8 },
  coverPlaceholder: { justifyContent: "center", alignItems: "center" },
  content: { flex: 1, justifyContent: "center", gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: {
    flex: 1,
    fontSize: 15,
    fontFamily: "SofiaSans-Bold",
    lineHeight: 20,
  },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontFamily: "SofiaSans-Bold" },
  infoRow: { flexDirection: "row", gap: 12 },
  infoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 12, fontFamily: "SofiaSans-Regular" },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryText: { fontSize: 10, fontFamily: "SofiaSans-Medium" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 2 },
  statText: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  statDivider: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  organizerRow: { flex: 1 },
  organizerText: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  fullBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  fullText: { fontSize: 10, color: "#ef4444", fontFamily: "SofiaSans-Bold" },
  chevron: { alignSelf: "center" },
});

export default EventSearchResult;
