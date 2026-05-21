import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { useTheme } from "../../../lib/contexts/ThemeContext";

// Post Skeleton - Matches PostCard layout exactly
const PostSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBlock = ({ style }: { style: any }) => (
    <Animated.View
      style={[style, { opacity, backgroundColor: colors.skeleton }]}
    />
  );

  return (
    <View style={[styles.postCard, { backgroundColor: colors.card }]}>
      {/* Post Header - matches paddingTop: 25, paddingHorizontal: 20 */}
      <View style={styles.postHeader}>
        <SkeletonBlock
          style={[
            styles.postAvatar,
            { backgroundColor: colors.skeletonHighlight },
          ]}
        />
        <View style={styles.postUserInfo}>
          <View style={styles.postUserRow}>
            <SkeletonBlock style={styles.postUserName} />
            <SkeletonBlock style={styles.visibilityBadge} />
          </View>
          <SkeletonBlock style={styles.postUserHandle} />
        </View>
        <SkeletonBlock style={styles.moreButton} />
      </View>

      {/* Post Content - matches paddingHorizontal: 20 */}
      <View style={styles.postContentContainer}>
        <SkeletonBlock style={styles.postContentLine1} />
        <SkeletonBlock style={styles.postContentLine2} />
        <SkeletonBlock style={styles.postContentLine3} />
      </View>

      {/* Post Image - matches imageHeight: 400, borderRadius: 12 */}
      <SkeletonBlock style={styles.postImage} />

      {/* Post Actions - matches paddingHorizontal: 20, borderTop */}
      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <View style={styles.actionItem}>
          <SkeletonBlock style={styles.actionIcon} />
          <SkeletonBlock style={styles.actionCount} />
        </View>
        <View style={styles.actionItem}>
          <SkeletonBlock style={styles.actionIcon} />
          <SkeletonBlock style={styles.actionCount} />
        </View>
        <SkeletonBlock style={styles.actionIcon} />
      </View>
    </View>
  );
};

// Full Feed Page Skeleton
export default function FeedSkeleton() {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBlock = ({ style }: { style: any }) => (
    <Animated.View
      style={[style, { opacity, backgroundColor: colors.skeleton }]}
    />
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Feed Header Skeleton */}
        <View style={styles.feedHeader}>
          <View>
            <SkeletonBlock style={styles.headerTitle} />
            <SkeletonBlock style={styles.headerSubtitle} />
          </View>
          <View style={styles.headerActions}>
            <SkeletonBlock style={styles.headerIcon} />
          </View>
        </View>

        {/* Create Post Button Skeleton */}
        <View
          style={[styles.createPostButton, { backgroundColor: colors.card }]}
        >
          <SkeletonBlock
            style={[
              styles.createPostAvatar,
              { backgroundColor: colors.skeletonHighlight },
            ]}
          />
          <SkeletonBlock style={styles.createPostText} />
          <SkeletonBlock style={styles.createPostIcon} />
        </View>

        {/* Filter Tabs Skeleton */}
        <View style={styles.filtersContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} style={styles.filterButton} />
            ))}
          </ScrollView>
        </View>

        {/* Post Skeletons */}
        <View style={styles.postsContainer}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      </ScrollView>
    </View>
  );
}

// Loading More Posts Skeleton
export function LoadMorePostsSkeleton() {
  return (
    <View style={styles.loadMoreContainer}>
      <PostSkeleton />
    </View>
  );
}

// Initial Posts Loading Skeleton
export function InitialPostsLoadingSkeleton() {
  return (
    <View style={styles.postsContainer}>
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  // Feed Header (matches FeedHeader styles)
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    width: 80,
    height: 28,
    borderRadius: 8,
    marginBottom: 6,
  },
  headerSubtitle: {
    width: 160,
    height: 14,
    borderRadius: 7,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  // Create Post Button (matches CreatePostButton styles)
  createPostButton: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "white",
    gap: 12,
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#d1d5db",
  },
  createPostText: {
    flex: 1,
    height: 15,
    borderRadius: 7,
  },
  createPostIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  // Filter Tabs (matches FilterTabs styles)
  filtersContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  filtersContent: {
    paddingRight: 20,
    paddingVertical: 4,
    gap: 12,
  },
  filterButton: {
    width: 90,
    height: 34,
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
  },
  // Post Cards
  postsContainer: {
    paddingHorizontal: 0,
  },
  postCard: {
    backgroundColor: "white",
    marginBottom: 16,
    marginHorizontal: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
  // Post Header
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 12,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#d1d5db",
  },
  postUserInfo: {
    flex: 1,
    gap: 4,
  },
  postUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  postUserName: {
    width: 120,
    height: 15,
    borderRadius: 7,
  },
  visibilityBadge: {
    width: 60,
    height: 20,
    borderRadius: 10,
  },
  postUserHandle: {
    width: 150,
    height: 13,
    borderRadius: 6,
  },
  moreButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  // Post Content
  postContentContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 6,
  },
  postContentLine1: {
    width: "95%",
    height: 15,
    borderRadius: 7,
  },
  postContentLine2: {
    width: "85%",
    height: 15,
    borderRadius: 7,
  },
  postContentLine3: {
    width: "45%",
    height: 15,
    borderRadius: 7,
  },
  // Post Image
  postImage: {
    width: "100%",
    height: 400,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    marginHorizontal: 0,
  },
  // Post Actions
  postActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginTop: 0,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  actionCount: {
    width: 24,
    height: 14,
    borderRadius: 7,
  },
  loadMoreContainer: {
    paddingTop: 0,
  },
});
