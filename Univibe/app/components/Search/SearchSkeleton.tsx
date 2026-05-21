import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useTheme } from "../../../lib/contexts/ThemeContext";

/**
 * Individual shimmering placeholder line
 */
const SkeletonLine: React.FC<{
  width: number | string;
  height?: number;
  style?: object;
}> = ({ width, height = 14, style }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

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

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius: height / 2,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for a user search result
 */
const UserResultSkeleton: React.FC = () => (
  <View style={styles.resultContainer}>
    {/* Avatar */}
    <SkeletonLine width={48} height={48} style={styles.avatarSkeleton} />

    {/* Info */}
    <View style={styles.infoSkeleton}>
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="40%" height={12} style={{ marginTop: 6 }} />
      <SkeletonLine width="80%" height={12} style={{ marginTop: 4 }} />
    </View>

    {/* Button */}
    <SkeletonLine width={80} height={32} style={{ borderRadius: 16 }} />
  </View>
);

/**
 * Skeleton for a post search result
 */
const PostResultSkeleton: React.FC = () => (
  <View style={styles.resultContainer}>
    {/* Author row */}
    <View style={styles.authorRow}>
      <SkeletonLine width={36} height={36} style={styles.avatarSkeleton} />
      <View style={styles.infoSkeleton}>
        <SkeletonLine width="50%" height={14} />
        <SkeletonLine width="35%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>

    {/* Content lines */}
    <SkeletonLine width="100%" height={14} style={{ marginBottom: 6 }} />
    <SkeletonLine width="75%" height={14} style={{ marginBottom: 8 }} />

    {/* Image placeholder */}
    <SkeletonLine
      width="100%"
      height={160}
      style={{ borderRadius: 8, marginBottom: 8 }}
    />

    {/* Engagement row */}
    <View style={styles.engagementRow}>
      <SkeletonLine width={40} height={12} />
      <SkeletonLine width={40} height={12} />
      <View style={{ flex: 1 }} />
      <SkeletonLine width={60} height={12} />
    </View>
  </View>
);

/**
 * Skeleton for an event search result
 */
const EventResultSkeleton: React.FC = () => (
  <View style={styles.resultContainer}>
    <View style={styles.eventRow}>
      {/* Thumbnail */}
      <SkeletonLine width={72} height={72} style={{ borderRadius: 8 }} />

      {/* Content */}
      <View style={styles.infoSkeleton}>
        <View style={styles.eventTitleRow}>
          <SkeletonLine width="70%" height={16} />
          <SkeletonLine width={60} height={20} style={{ borderRadius: 6 }} />
        </View>
        <SkeletonLine width="50%" height={12} style={{ marginTop: 6 }} />
        <View style={[styles.engagementRow, { marginTop: 6 }]}>
          <SkeletonLine width={50} height={12} />
          <SkeletonLine width={40} height={12} />
          <SkeletonLine width="30%" height={12} />
        </View>
      </View>
    </View>
  </View>
);

/**
 * Full search skeleton showing multiple results
 */
interface SearchSkeletonProps {
  type?: "users" | "posts" | "events" | "mixed";
  count?: number;
}

export const SearchSkeleton: React.FC<SearchSkeletonProps> = ({
  type = "mixed",
  count = 5,
}) => {
  const { colors } = useTheme();

  const renderSkeleton = (index: number) => {
    switch (type) {
      case "users":
        return <UserResultSkeleton key={index} />;
      case "posts":
        return <PostResultSkeleton key={index} />;
      case "events":
        return <EventResultSkeleton key={index} />;
      case "mixed":
      default:
        // Alternate between types for mixed
        if (index % 3 === 0) return <UserResultSkeleton key={index} />;
        if (index % 3 === 1) return <PostResultSkeleton key={index} />;
        return <EventResultSkeleton key={index} />;
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: count }, (_, index) => renderSkeleton(index))}
    </View>
  );
};

/**
 * Initial search skeleton (shown on first load before user types)
 */
export const InitialSearchSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Search bar skeleton */}
      <View style={styles.searchBarSkeleton}>
        <SkeletonLine width="100%" height={44} style={{ borderRadius: 12 }} />
      </View>

      {/* Category tabs skeleton */}
      <View style={styles.categoriesSkeleton}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonLine
            key={i}
            width={80}
            height={36}
            style={{ borderRadius: 20, marginRight: 8 }}
          />
        ))}
      </View>

      {/* Section title */}
      <SkeletonLine
        width="40%"
        height={18}
        style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 12 }}
      />

      {/* Result skeletons */}
      <SearchSkeleton type="mixed" count={6} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  searchBarSkeleton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoriesSkeleton: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  avatarSkeleton: {
    borderRadius: 24,
  },
  infoSkeleton: {
    flex: 1,
    justifyContent: "center",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },
  engagementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  eventRow: {
    flexDirection: "row",
    gap: 12,
  },
  eventTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
});

export default SearchSkeleton;
