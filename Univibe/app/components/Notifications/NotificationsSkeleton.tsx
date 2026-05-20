import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// ============================================
// SHIMMER BLOCK
// ============================================

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: "#E5E7EB",
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#F3F4F6",
            opacity: 0.6,
          }}
        />
      </Animated.View>
    </View>
  );
};

// ============================================
// NOTIFICATION ITEM SKELETON
// ============================================

const NotificationItemSkeleton: React.FC<{ isPendingRequest?: boolean }> = ({
  isPendingRequest = false,
}) => (
  <View style={styles.notifCard}>
    {/* Avatar */}
    <View style={styles.avatarWrapper}>
      <SkeletonBlock width={52} height={52} borderRadius={26} />
      {!isPendingRequest && (
        <View style={styles.smallIconSkeleton}>
          <SkeletonBlock width={22} height={22} borderRadius={11} />
        </View>
      )}
    </View>

    {/* Content */}
    <View style={styles.contentContainer}>
      <SkeletonBlock width="75%" height={14} style={{ marginBottom: 6 }} />
      <SkeletonBlock width="55%" height={12} style={{ marginBottom: 4 }} />
      {isPendingRequest && (
        <SkeletonBlock width={110} height={11} style={{ marginBottom: 2 }} />
      )}
    </View>

    {/* Actions (for pending requests) */}
    {isPendingRequest && (
      <View style={styles.actionsSkeleton}>
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <SkeletonBlock width={40} height={40} borderRadius={20} />
      </View>
    )}

    {/* Options dots */}
    {!isPendingRequest && (
      <View style={styles.optionsSkeleton}>
        <Ionicons name="ellipsis-vertical" size={18} color="#D1D5DB" />
      </View>
    )}
  </View>
);

// ============================================
// MAIN SKELETON
// ============================================

const NotificationsSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#D1D5DB" />
        </View>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.listContent}>
        {/* ── Date Section Header ── */}
        <View style={styles.dateHeader}>
          <SkeletonBlock width={55} height={14} style={{ marginRight: 12 }} />
          <View style={styles.dateLine} />
        </View>

        {/* ── Pending Connection Requests ── */}
        <View style={styles.dateHeader}>
          <SkeletonBlock width={140} height={14} style={{ marginRight: 12 }} />
          <View style={styles.dateLine} />
        </View>

        <NotificationItemSkeleton isPendingRequest />
        <NotificationItemSkeleton isPendingRequest />

        {/* ── Another Date Section ── */}
        <View style={styles.dateHeader}>
          <SkeletonBlock width={70} height={14} style={{ marginRight: 12 }} />
          <View style={styles.dateLine} />
        </View>

        {/* ── Regular Notifications ── */}
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />

        {/* ── Older Date Section ── */}
        <View style={styles.dateHeader}>
          <SkeletonBlock width={90} height={14} style={{ marginRight: 12 }} />
          <View style={styles.dateLine} />
        </View>

        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
        <NotificationItemSkeleton />
      </View>
    </SafeAreaView>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: {
    width: 40,
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  smallIconSkeleton: {
    position: "absolute",
    bottom: -2,
    right: -2,
  },
  contentContainer: {
    flex: 1,
  },
  actionsSkeleton: {
    flexDirection: "row",
    gap: 8,
  },
  optionsSkeleton: {
    padding: 6,
    marginLeft: 4,
  },
});

export default NotificationsSkeleton;
