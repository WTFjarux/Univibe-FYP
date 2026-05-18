// app/components/CampusMoments.tsx - Professional loading with skeleton states

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
import { useAuth } from "../../lib/contexts/AuthContext";
import storyApi from "../../lib/services/storyApi";
import socketService from "../../lib/services/socketService";
import { API_BASE_URL } from "../../constants/ipConstants";
import type { StoryGroup } from "../../lib/services/storyApi";

interface CampusMomentsProps {
  onStoryPress?: (storyGroup: StoryGroup) => void;
  initialLoading?: boolean; // Parent can control initial loading state
}

// Skeleton component for story loading
const StorySkeleton = () => {
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
          { opacity: shimmerOpacity },
        ]}
      >
        <View style={[styles.storyAvatar, styles.skeletonAvatar]} />
      </Animated.View>
      <Animated.View
        style={[styles.skeletonText, { opacity: shimmerOpacity }]}
      />
    </View>
  );
};

// Skeleton grid for initial loading
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
  const [stories, setStories] = useState<StoryGroup[]>([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [userStoryGroup, setUserStoryGroup] = useState<StoryGroup | null>(null);
  const [otherStories, setOtherStories] = useState<StoryGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs to prevent race conditions
  const isFetchingRef = useRef(false);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchStories = useCallback(
    async (showLoading = true) => {
      // Prevent multiple simultaneous fetches
      if (isFetchingRef.current) {
        console.log("Fetch already in progress, skipping...");
        return;
      }

      if (!token) {
        setLoadingStories(false);
        return;
      }

      isFetchingRef.current = true;

      if (showLoading) {
        setLoadingStories(true);
      }

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
          console.error("Failed to fetch stories");
          setError("Failed to load stories");
        }
      } catch (error: any) {
        // Ignore cancelled requests
        if (
          error?.statusCode !== 499 &&
          error?.message !== "Request cancelled"
        ) {
          console.error("Error fetching stories:", error);
          setError("Unable to load stories");
        }
      } finally {
        if (mountedRef.current) {
          setLoadingStories(false);
        }
        isFetchingRef.current = false;
      }
    },
    [token, user?.id],
  );

  // Debounced fetch to prevent rapid successive calls
  const debouncedFetch = useCallback(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchStories(false); // Don't show loading for real-time updates
    }, 300);
  }, [fetchStories]);

  // Initial fetch - ensure it runs properly
  useEffect(() => {
    mountedRef.current = true;

    // Small delay to ensure component is fully mounted
    const initTimer = setTimeout(() => {
      fetchStories(true);
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimer);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchStories]);

  // Listen for real-time story updates via socket
  useEffect(() => {
    if (!token) return;

    const handleStoryUpdate = (data: any) => {
      console.log("Story update received, refreshing...", data);
      debouncedFetch();
    };

    socketService.on("story_created", handleStoryUpdate);
    socketService.on("story_viewed", handleStoryUpdate);
    socketService.on("story_deleted", handleStoryUpdate);

    return () => {
      socketService.off("story_created", handleStoryUpdate);
      socketService.off("story_viewed", handleStoryUpdate);
      socketService.off("story_deleted", handleStoryUpdate);
    };
  }, [token, debouncedFetch]);

  const handleCreateStoryPress = () => {
    router.push("/screens/CreateStoryScreen");
  };

  const handleStoryPress = (storyGroup: StoryGroup) => {
    if (onStoryPress) {
      onStoryPress(storyGroup);
    }
  };

  const handleSeeAllPress = () => {
    // If you have a dedicated stories screen, navigate there
    // Otherwise, you can expand the current view
    console.log("See all stories pressed");
  };

  // Helper functions
  const getProfilePictureUrl = (
    profilePicture: string | null,
  ): string | undefined => {
    if (!profilePicture || profilePicture.trim() === "") return undefined;
    if (
      profilePicture.startsWith("http://") ||
      profilePicture.startsWith("https://")
    ) {
      return profilePicture;
    }
    return `${API_BASE_URL}${profilePicture}`;
  };

  const getUserProfilePictureUrl = (): string | undefined => {
    const profilePic = profile?.profilePicture || profile?.avatar;
    return getProfilePictureUrl(profilePic || null);
  };

  const getUserDisplayName = (): string => {
    return user?.name || user?.username || "User";
  };

  const getUserInitial = (): string => {
    return getUserDisplayName().charAt(0).toUpperCase();
  };

  const getInitials = (name: string) => {
    if (!name) return "?";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  const hasActiveStories = (): boolean => {
    return !!userStoryGroup && userStoryGroup.stories.length > 0;
  };

  const hasUnseenStories = (storyGroup: StoryGroup): boolean => {
    return storyGroup.hasUnseen === true;
  };

  const truncateName = (name: string, maxLength: number = 12): string => {
    if (!name) return "User";
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 2) + "...";
  };

  return (
    <View style={styles.momentsSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Campus Moments</Text>
        <TouchableOpacity onPress={handleSeeAllPress}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {loadingStories ? (
        <StoriesSkeleton />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
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
          {/* User's Own Story - Always visible like Instagram */}
          <TouchableOpacity
            style={styles.storyCard}
            onPress={() => {
              if (userStoryGroup) {
                handleStoryPress(userStoryGroup);
              } else {
                handleCreateStoryPress();
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.userStoryContainer}>
              <View
                style={[
                  styles.storyRing,
                  hasActiveStories()
                    ? styles.unviewedRing
                    : styles.addStoryRing,
                ]}
              >
                {getUserProfilePictureUrl() ? (
                  <Image
                    source={{ uri: getUserProfilePictureUrl() }}
                    style={styles.storyAvatarImage}
                  />
                ) : (
                  <View style={[styles.storyAvatar, styles.userAvatar]}>
                    <Text style={styles.avatarText}>{getUserInitial()}</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.addButtonOverlay}
                onPress={handleCreateStoryPress}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.storyName} numberOfLines={1}>
              {userStoryGroup ? "Your Moment" : "Add Moment"}
            </Text>
          </TouchableOpacity>

          {/* Other Users' Stories */}
          {otherStories.map((storyGroup) => {
            const profilePictureUrl = getProfilePictureUrl(
              storyGroup.profilePicture,
            );
            const hasUnseen = hasUnseenStories(storyGroup);
            const displayName = truncateName(storyGroup.userName || "User");

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
                    hasUnseen ? styles.unviewedRing : styles.viewedRing,
                  ]}
                >
                  {profilePictureUrl ? (
                    <Image
                      source={{ uri: profilePictureUrl }}
                      style={styles.storyAvatarImage}
                    />
                  ) : (
                    <View style={styles.storyAvatar}>
                      <Text style={styles.avatarText}>
                        {getInitials(storyGroup.userName)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  {displayName}
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
  momentsSection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  seeAllText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  storiesContainer: {
    flexDirection: "row",
  },
  storiesContentContainer: {
    paddingRight: 20,
  },
  storyCard: {
    alignItems: "center",
    marginRight: 16,
    width: 90,
  },
  storyRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginBottom: 8,
  },
  unviewedRing: {
    borderWidth: 3,
    borderColor: "#8b5cf6",
    padding: 3,
  },
  viewedRing: {
    borderWidth: 3,
    borderColor: "#e5e7eb",
    padding: 3,
  },
  addStoryRing: {
    borderWidth: 3,
    borderColor: "#e5e7eb",
    padding: 3,
  },
  storyAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatar: {
    backgroundColor: "#7c3aed", // Slightly different shade for user's avatar
  },
  storyAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: "white",
    fontSize: 32,
    fontWeight: "600",
  },
  storyName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    width: 90,
  },
  userStoryContainer: {
    position: "relative",
    marginBottom: 8,
  },
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
  // Error state styles
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
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  // Skeleton styles
  skeletonRing: {
    borderWidth: 3,
    borderColor: "#e5e7eb",
    padding: 3,
    backgroundColor: "#f3f4f6",
  },
  skeletonAvatar: {
    backgroundColor: "#e5e7eb",
  },
  skeletonText: {
    width: 70,
    height: 12,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 4,
  },
});
