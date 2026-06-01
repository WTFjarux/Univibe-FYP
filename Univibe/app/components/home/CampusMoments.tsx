// app/components/CampusMoments.tsx 

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/contexts/AuthContext";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import storyApi from "../../../lib/services/storyApi";
import socketService from "../../../lib/services/socketService";
import { API_BASE_URL } from "../../../constants/ipConstants";
import type { StoryGroup } from "../../../lib/services/storyApi";

const DEFAULT_AVATAR = require("../../../assets/images/default-avatar.png");

interface CampusMomentsProps {
  onStoryPress?: (storyGroup: StoryGroup) => void;
  initialLoading?: boolean;
}

// Skeleton component for story loading
const StorySkeleton = () => {
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

  const shimmerOpacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.storyCard}>
      <Animated.View
        style={[
          styles.storyRing,
          styles.skeletonRing,
          {
            opacity: shimmerOpacity,
            backgroundColor: colors.skeleton,
            borderColor: colors.skeletonHighlight,
          },
        ]}
      >
        <View
          style={[
            styles.storyAvatarImage,
            styles.skeletonAvatar,
            { backgroundColor: colors.skeletonHighlight },
          ]}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.skeletonText,
          { opacity: shimmerOpacity, backgroundColor: colors.skeleton },
        ]}
      />
    </View>
  );
};

const StoriesSkeleton = () => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.storiesContainer}
    contentContainerStyle={styles.storiesContentContainer}
  >
    {[...Array(6)].map((_, index) => (
      <StorySkeleton key={`skeleton-${index}`} />
    ))}
  </ScrollView>
);

export default function CampusMoments({
  onStoryPress,
  initialLoading,
}: CampusMomentsProps) {
  const router = useRouter();
  const { token, user, profile } = useAuth();
  const { colors, isDark } = useTheme();
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [userStoryGroup, setUserStoryGroup] = useState<StoryGroup | null>(null);
  const [otherStories, setOtherStories] = useState<StoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchStories = useCallback(
    async (showLoading = true) => {
      if (isFetchingRef.current) return;
      if (!token) {
        setLoadingStories(false);
        return;
      }
      isFetchingRef.current = true;
      if (showLoading) setLoadingStories(true);
      setError(null);
      try {
        const response = await storyApi.getStories(1, 20, false);
        if (!mountedRef.current) return;
        if (response.success) {
          setStories(response.data || []);
          const userStory = response.data?.find(
            (group: StoryGroup) => group.userId === user?.id,
          );
          const otherUsersStories =
            response.data?.filter(
              (group: StoryGroup) => group.userId !== user?.id,
            ) || [];
          setUserStoryGroup(userStory || null);
          setOtherStories(otherUsersStories);
        } else {
          setError("Failed to load stories");
        }
      } catch (error: any) {
        if (
          error?.statusCode !== 499 &&
          error?.message !== "Request cancelled"
        ) {
          setError("Unable to load stories");
        }
      } finally {
        if (mountedRef.current) setLoadingStories(false);
        isFetchingRef.current = false;
      }
    },
    [token, user?.id],
  );

  const debouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => fetchStories(false), 300);
  }, [fetchStories]);

  useEffect(() => {
    mountedRef.current = true;
    const initTimer = setTimeout(() => fetchStories(true), 100);
    return () => {
      mountedRef.current = false;
      clearTimeout(initTimer);
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [fetchStories]);

  useEffect(() => {
    if (!token) return;
    const handleStoryUpdate = () => debouncedFetch();
    socketService.on("story_created", handleStoryUpdate);
    socketService.on("story_viewed", handleStoryUpdate);
    socketService.on("story_deleted", handleStoryUpdate);
    return () => {
      socketService.off("story_created", handleStoryUpdate);
      socketService.off("story_viewed", handleStoryUpdate);
      socketService.off("story_deleted", handleStoryUpdate);
    };
  }, [token, debouncedFetch]);

  const handleCreateStoryPress = () =>
    router.push("/screens/CreateStoryScreen");
  const handleStoryPress = (storyGroup: StoryGroup) => {
    if (onStoryPress) onStoryPress(storyGroup);
  };

  const getProfilePictureUrl = (
    profilePicture: string | null,
  ): string | undefined => {
    if (!profilePicture || profilePicture.trim() === "") return undefined;
    if (
      profilePicture.startsWith("http://") ||
      profilePicture.startsWith("https://")
    )
      return profilePicture;
    return `${API_BASE_URL}${profilePicture}`;
  };

  const getUserProfilePictureUrl = (): string | undefined => {
    const profilePic = profile?.profilePicture || profile?.avatar;
    return getProfilePictureUrl(profilePic || null);
  };

  const hasActiveStories = (): boolean =>
    !!userStoryGroup && userStoryGroup.stories.length > 0;
  const hasUnseenStories = (storyGroup: StoryGroup): boolean =>
    storyGroup.hasUnseen === true;
  const truncateName = (name: string, maxLength: number = 12): string => {
    if (!name) return "User";
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 2) + "...";
  };

  return (
    <View style={styles.momentsSection}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Campus Moments
        </Text>
      </View>

      {loadingStories ? (
        <StoriesSkeleton />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={[
              styles.retryButton,
              { backgroundColor: isDark ? "#451a1a" : "#fee2e2" },
            ]}
            onPress={() => fetchStories(true)}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storiesContainer}
          contentContainerStyle={styles.storiesContentContainer}
        >
          {/* User's Own Story */}
          <TouchableOpacity
            style={styles.storyCard}
            onPress={() => {
              if (userStoryGroup) handleStoryPress(userStoryGroup);
              else handleCreateStoryPress();
            }}
            activeOpacity={0.7}
          >
            <View style={styles.userStoryContainer}>
              <View
                style={[
                  styles.storyRing,
                  { backgroundColor: colors.skeleton },
                  hasActiveStories()
                    ? [styles.unviewedRing, { borderColor: colors.primary }]
                    : [styles.addStoryRing, { borderColor: colors.border }],
                ]}
              >
                <Image
                  source={
                    getUserProfilePictureUrl()
                      ? { uri: getUserProfilePictureUrl() }
                      : DEFAULT_AVATAR
                  }
                  style={styles.storyAvatarImage}
                />
              </View>
              <TouchableOpacity
                style={[styles.addButtonOverlay, { borderColor: colors.card }]}
                onPress={handleCreateStoryPress}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.storyName, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {userStoryGroup ? "Your Moment" : "Add Moment"}
            </Text>
          </TouchableOpacity>

          {/* Other Users' Stories */}
          {otherStories.map((storyGroup) => {
            const profilePictureUrl = getProfilePictureUrl(
              storyGroup.profilePicture,
            );
            const hasUnseen = hasUnseenStories(storyGroup);
            return (
              <TouchableOpacity
                key={storyGroup.userId}
                style={styles.storyCard}
                onPress={() => handleStoryPress(storyGroup)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.storyRing,
                    { backgroundColor: colors.skeleton },
                    hasUnseen
                      ? [styles.unviewedRing, { borderColor: colors.primary }]
                      : [styles.viewedRing, { borderColor: colors.border }],
                  ]}
                >
                  <Image
                    source={
                      profilePictureUrl
                        ? { uri: profilePictureUrl }
                        : DEFAULT_AVATAR
                    }
                    style={styles.storyAvatarImage}
                  />
                </View>
                <Text
                  style={[styles.storyName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {truncateName(storyGroup.userName || "User")}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  momentsSection: { marginBottom: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontFamily: "SofiaSans-Bold" },
  storiesContainer: { flexDirection: "row" },
  storiesContentContainer: { paddingRight: 20 },
  storyCard: { alignItems: "center", marginRight: 16, width: 90 },
  storyRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginBottom: 8,
    overflow: "hidden",
  },
  unviewedRing: { borderWidth: 3, borderColor: "#8b5cf6", padding: 3 },
  viewedRing: { borderWidth: 3, borderColor: "#e5e7eb", padding: 3 },
  addStoryRing: { borderWidth: 3, borderColor: "#e5e7eb", padding: 3 },
  storyAvatarImage: { width: 80, height: 80, borderRadius: 40 },
  storyName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    width: 90,
    fontFamily: "SofiaSans-Medium",
  },
  userStoryContainer: { position: "relative", marginBottom: 8 },
  addButtonOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#8b5cf6",
    borderWidth: 2.5,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  skeletonRing: {
    borderWidth: 3,
    borderColor: "#e5e7eb",
    padding: 3,
    backgroundColor: "#f3f4f6",
  },
  skeletonAvatar: { backgroundColor: "#e5e7eb" },
  skeletonText: {
    width: 70,
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 4,
  },
});
