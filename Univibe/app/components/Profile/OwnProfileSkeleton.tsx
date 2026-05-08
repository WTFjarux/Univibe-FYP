// app/components/Profile/OwnProfileSkeleton.tsx
// This skeleton is specifically for the user's own profile (tabs/profile/index.tsx)

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";

// Post Skeleton - Matches PostCard layout
const PostSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0)).current;

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
    <Animated.View style={[style, { opacity, backgroundColor: "#e5e7eb" }]} />
  );

  return (
    <View style={styles.postCardWrapper}>
      <View style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <SkeletonBlock style={styles.postAvatar} />
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
        <View style={styles.postActions}>
          <SkeletonBlock style={styles.actionButton} />
          <SkeletonBlock style={styles.actionButton} />
          <SkeletonBlock style={styles.actionButton} />
        </View>
      </View>
    </View>
  );
};

// Full Own Profile Page Skeleton
export default function OwnProfilePageSkeleton() {
  const shimmerValue = useRef(new Animated.Value(0)).current;

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
    <Animated.View style={[style, { opacity, backgroundColor: "#e5e7eb" }]} />
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Photo - Camera button visible for own profile */}
        <View style={styles.coverPhotoContainer}>
          <SkeletonBlock style={styles.coverPhoto} />
          <SkeletonBlock style={styles.coverCameraButton} />
        </View>

        {/* Profile Picture and Name Section */}
        <View style={styles.profileImageNameContainer}>
          <View style={styles.profileImageWrapper}>
            <SkeletonBlock style={styles.profileImage} />
            {/* Camera overlay on profile pic */}
            <SkeletonBlock style={styles.profileCameraOverlay} />
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

        {/* Profile Tabs */}
        <View style={styles.tabsContainer}>
          <SkeletonBlock style={styles.tabButton} />
          <SkeletonBlock style={styles.tabButton} />
        </View>

        {/* Content Area (About tab by default) */}
        <View style={styles.contentContainer}>
          {/* About Card */}
          <View style={styles.aboutSection}>
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

          {/* Stats Card */}
          <View style={styles.statsSection}>
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

          {/* Menu Items (Edit Profile, Settings, etc.) */}
          <View style={styles.menuSection}>
            {[
              { icon: "create-outline", text: "Edit Profile" },
              { icon: "settings-outline", text: "Settings" },
              { icon: "help-circle-outline", text: "Help & Support" },
              { icon: "log-out-outline", text: "Logout" },
            ].map((item, i) => (
              <View key={i}>
                <View style={styles.menuItem}>
                  <SkeletonBlock style={styles.menuIcon} />
                  <SkeletonBlock style={styles.menuText} />
                  <SkeletonBlock style={styles.menuArrow} />
                </View>
                {i < 3 && <View style={styles.menuDivider} />}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Posts Tab Loading Skeleton
export function OwnPostsLoadingSkeleton() {
  return (
    <View style={styles.postsLoadingContainer}>
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </View>
  );
}

// Loading More Posts Skeleton
export function OwnLoadingMorePostsSkeleton() {
  return (
    <View style={styles.loadingMoreContainer}>
      <PostSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  // Cover Photo
  coverPhotoContainer: {
    position: "relative",
    height: 180,
  },
  coverPhoto: {
    width: "100%",
    height: 180,
    backgroundColor: "#e5e7eb",
  },
  coverCameraButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  // Profile Picture and Name
  profileImageNameContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: -48,
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  profileImageWrapper: {
    position: "relative",
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
  profileCameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
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
  // Bio
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
  // Tabs
  tabsContainer: {
    flexDirection: "row",
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    height: 40,
    borderRadius: 10,
  },
  // Content Area
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  // About Section
  aboutSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
  // Stats Section
  statsSection: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
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
  // Menu Section
  menuSection: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  menuIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  menuText: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    marginLeft: 12,
  },
  menuArrow: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 52,
  },
  // Post Card Styles
  postsLoadingContainer: {
    paddingTop: 0,
  },
  loadingMoreContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  postCardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  postCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
    height: 300,
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
});
