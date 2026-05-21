// app/components/Profile/ProfileSkeleton.tsx

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { useTheme } from "../../../lib/contexts/ThemeContext";

// Props interface for the skeleton
interface ProfileSkeletonProps {
  isOwnProfile?: boolean;
}

// Individual Post Skeleton Component
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
      {/* Post Header */}
      <View style={styles.postHeader}>
        <SkeletonBlock
          style={[
            styles.postAvatar,
            { backgroundColor: colors.skeletonHighlight },
          ]}
        />
        <View style={styles.postUserInfo}>
          <SkeletonBlock style={styles.postUserName} />
          <SkeletonBlock style={styles.postUserHandle} />
        </View>
        <SkeletonBlock style={styles.moreButton} />
      </View>

      {/* Post Content */}
      <View style={styles.postContentContainer}>
        <SkeletonBlock style={styles.postContentLine1} />
        <SkeletonBlock style={styles.postContentLine2} />
      </View>

      {/* Post Image */}
      <SkeletonBlock style={styles.postImage} />

      {/* Post Actions */}
      <View style={[styles.postActions, { borderTopColor: colors.border }]}>
        <SkeletonBlock style={styles.actionButton} />
        <SkeletonBlock style={styles.actionButton} />
        <SkeletonBlock style={styles.actionButton} />
      </View>
    </View>
  );
};

// Main Profile Skeleton Component - NOW ACCEPTS PROPS
export default function ProfileSkeleton({
  isOwnProfile = false,
}: ProfileSkeletonProps) {
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
      {/* Header with back button and name */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <SkeletonBlock style={styles.backButton} />
        <SkeletonBlock style={styles.headerTitleSkeleton} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo */}
        <SkeletonBlock style={styles.coverPhoto} />

        {/* Profile Picture and Name Section */}
        <View style={styles.profileImageNameContainer}>
          <View style={styles.profileImageWrapper}>
            <SkeletonBlock
              style={[styles.profileImage, { borderColor: colors.card }]}
            />
          </View>
          <View style={styles.nameUsernameContainer}>
            <SkeletonBlock style={styles.fullNameSkeleton} />
            <SkeletonBlock style={styles.usernameSkeleton} />
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioContainer}>
          <SkeletonBlock style={styles.bioLine1} />
          <SkeletonBlock style={styles.bioLine2} />
        </View>

        {/* Connection Buttons - Only show if not own profile */}
        {!isOwnProfile && (
          <View style={styles.buttonsContainer}>
            <SkeletonBlock style={styles.button} />
            <SkeletonBlock style={styles.button} />
          </View>
        )}

        {/* About Section */}
        <View style={[styles.aboutSection, { backgroundColor: colors.card }]}>
          <SkeletonBlock style={styles.sectionTitle} />
          <View style={styles.infoItem}>
            <SkeletonBlock style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <SkeletonBlock style={styles.infoLabel} />
              <SkeletonBlock style={styles.infoValue} />
            </View>
          </View>
          <View style={styles.infoItem}>
            <SkeletonBlock style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <SkeletonBlock style={styles.infoLabel} />
              <SkeletonBlock style={styles.infoValueSmall} />
            </View>
          </View>
          <View style={styles.infoItem}>
            <SkeletonBlock style={styles.infoIcon} />
            <View style={styles.infoContent}>
              <SkeletonBlock style={styles.infoLabel} />
              <SkeletonBlock style={styles.infoValue} />
            </View>
          </View>
        </View>

        {/* Activity Section */}
        <View style={[styles.statsSection, { backgroundColor: colors.card }]}>
          <SkeletonBlock style={styles.sectionTitle} />
          <View style={styles.statsContainer}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.statItem}>
                <SkeletonBlock style={styles.statIcon} />
                <SkeletonBlock style={styles.statNumber} />
                <SkeletonBlock style={styles.statLabel} />
              </View>
            ))}
          </View>
        </View>

        {/* Posts Header */}
        <View style={styles.postsHeader}>
          <SkeletonBlock style={styles.postsTitleSkeleton} />
        </View>

        {/* Post Cards */}
        <PostSkeleton />
        <PostSkeleton />
      </ScrollView>
    </View>
  );
}

// Loading More Posts Skeleton (for pagination)
export function LoadingMorePostsSkeleton() {
  return (
    <View style={styles.loadingMoreContainer}>
      <PostSkeleton />
    </View>
  );
}

// Individual Post Skeleton for initial posts loading
export function InitialPostsSkeleton() {
  return (
    <View>
      <View style={styles.postsHeader}>
        <View style={styles.postsTitleSkeletonPlaceholder} />
      </View>
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
  // Header Styles
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: -8,
  },
  headerTitleSkeleton: {
    width: 150,
    height: 24,
    borderRadius: 12,
  },
  headerSpacer: {
    width: 40,
  },

  // Cover Photo Styles
  coverPhoto: {
    width: "100%",
    height: 180,
    backgroundColor: "#e5e7eb",
  },

  // Profile Picture and Name Styles
  profileImageNameContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: -48,
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  profileImageWrapper: {
    marginRight: 16,
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: "white",
    backgroundColor: "#d1d5db",
  },
  nameUsernameContainer: {
    flex: 1,
    marginBottom: 10,
    gap: 6,
  },
  fullNameSkeleton: {
    width: 180,
    height: 20,
    borderRadius: 10,
  },
  usernameSkeleton: {
    width: 120,
    height: 16,
    borderRadius: 8,
  },

  // Bio Styles
  bioContainer: {
    marginTop: 18,
    marginHorizontal: 25,
    marginBottom: 8,
    gap: 6,
  },
  bioLine1: {
    width: "90%",
    height: 15,
    borderRadius: 7,
  },
  bioLine2: {
    width: "60%",
    height: 15,
    borderRadius: 7,
  },

  // Connection Buttons Styles
  buttonsContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 25,
  },

  // About Section Styles
  aboutSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  sectionTitle: {
    width: 80,
    height: 20,
    borderRadius: 10,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
    gap: 4,
  },
  infoLabel: {
    width: 60,
    height: 13,
    borderRadius: 6,
  },
  infoValue: {
    width: "80%",
    height: 16,
    borderRadius: 8,
  },
  infoValueSmall: {
    width: "60%",
    height: 16,
    borderRadius: 8,
  },

  // Activity Section Styles
  statsSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    marginHorizontal: 20,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  statIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginBottom: 2,
  },
  statNumber: {
    width: 40,
    height: 24,
    borderRadius: 12,
  },
  statLabel: {
    width: 60,
    height: 13,
    borderRadius: 6,
  },

  // Posts Header Styles
  postsHeader: {
    marginTop: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  postsTitleSkeleton: {
    width: 80,
    height: 24,
    borderRadius: 12,
  },
  postsTitleSkeletonPlaceholder: {
    width: 80,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },

  // Post Card Styles
  postCard: {
    backgroundColor: "white",
    marginBottom: 16,
    marginHorizontal: 0,
    borderRadius: 16,
    overflow: "hidden",
  },
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
  postUserName: {
    width: 120,
    height: 15,
    borderRadius: 7,
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
    width: "70%",
    height: 15,
    borderRadius: 7,
  },
  postImage: {
    width: "100%",
    height: 400,
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
    marginHorizontal: 0,
  },
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
  actionButton: {
    width: 60,
    height: 20,
    borderRadius: 10,
  },

  // Loading More Container
  loadingMoreContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
});
