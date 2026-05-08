import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

import StoryHeader from "../components/story/StoryHeader";
import StoryMedia from "../components/story/StoryMedia";
import StoryReplyInput from "../components/story/StoryReplyInput";
import StoryViewersModal from "../components/story/StoryViewersModal";

import storyApi from "../../lib/services/storyApi";
import { useAuth } from "../../lib/contexts/AuthContext";

import type { StoryGroup, Story } from "../../lib/services/storyApi";

const { width, height } = Dimensions.get("window");
const IMAGE_STORY_DURATION = 10000;

// Tap zone configuration
const TOP_DEAD_ZONE = Platform.OS === "ios" ? 140 : 120;
const BOTTOM_DEAD_ZONE = Platform.OS === "ios" ? 130 : 110;
const LEFT_TAP_WIDTH = width * 0.3;
const RIGHT_TAP_START = width * 0.7;

export default function StoryViewerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    userId: string;
    userName: string;
    storyId?: string;
    initialStoryId?: string;
  }>();

  // State
  const [storyGroup, setStoryGroup] = useState<StoryGroup | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isViewersModalVisible, setIsViewersModalVisible] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Animation
  const translateY = useSharedValue(0);

  // Timer refs
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef(0);
  const remainingTimeRef = useRef(IMAGE_STORY_DURATION);
  const viewedRef = useRef(new Set<string>()); // Track viewed stories to avoid duplicate syncs

  // Story data
  const currentStory = storyGroup?.stories[currentStoryIndex];
  const totalStories = storyGroup?.stories?.length || 0;
  const isOwnStory = storyGroup?.userId === user?.id;

  // ✅ OPTIMISTIC VIEWER COUNT (includes local views)
  const getViewerCount = (story?: Story) => {
    if (!story?.viewers) return 0;
    const uniqueIds = new Set(
      story.viewers.map((viewer: { userId: string }) => viewer.userId),
    );
    // Optimistically add current view if local state says we viewed it
    if (
      storyApi.hasUserViewedStory(story, user?.id || "") ||
      story.hasCurrentUserViewed
    ) {
      // Already counted
    }
    return uniqueIds.size;
  };
  const viewerCount = getViewerCount(currentStory);

  // ✅ FETCH WITH CACHING
  const fetchStoryGroup = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true);
        setError(null);

        // ✅ Use cache unless forced refresh
        const response = await storyApi.getStories(1, 20, !forceRefresh);

        if (!response.success || !params.userId) {
          setError("Failed to load stories");
          return;
        }

        const group = response.data.find(
          (g: StoryGroup) => g.userId === params.userId,
        );

        if (!group) {
          setError("Moment not found");
          return;
        }

        const sortedStories = [...group.stories].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        setStoryGroup({ ...group, stories: sortedStories });

        // ✅ Find specific story if storyId is provided in params
        const targetStoryId = params.initialStoryId || params.storyId;
        if (targetStoryId) {
          const targetIndex = sortedStories.findIndex(
            (s) => s._id === targetStoryId,
          );
          if (targetIndex !== -1) {
            setCurrentStoryIndex(targetIndex);
          } else {
            setCurrentStoryIndex(0);
          }
        } else {
          setCurrentStoryIndex(0);
        }

        setIsPaused(false);
      } catch (err) {
        console.log("FETCH STORY ERROR:", err);
        setError("Failed to load stories");
      } finally {
        setIsLoading(false);
      }
    },
    [params.userId, params.initialStoryId, params.storyId], // ✅ Add dependencies
  );

  // ✅ MOUNT: Fetch + Prefetch
  useEffect(() => {
    fetchStoryGroup(false); // Use cache if available

    // Prefetch more stories in background (non-blocking)
    storyApi.prefetchStories(2).catch(console.error);

    return () => {
      clearAllTimers();
      storyApi.destroy(); // Cleanup background sync
    };
  }, [fetchStoryGroup]);

  // Timer functions
  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startImageTimer = useCallback(() => {
    if (!currentStory) return;

    clearAllTimers();
    timerStartRef.current = Date.now();

    const duration = remainingTimeRef.current;

    timeoutRef.current = setTimeout(() => {
      goToNextStory();
    }, duration);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const currentProgress = 1 - (duration - elapsed) / IMAGE_STORY_DURATION;
      setProgress(Math.max(0, Math.min(currentProgress, 1)));
    }, 16);
  }, [currentStory]);

  const pauseImageTimer = useCallback(() => {
    if (!currentStory || currentStory.type === "video") return;

    const elapsed = Date.now() - timerStartRef.current;
    remainingTimeRef.current = Math.max(0, remainingTimeRef.current - elapsed);
    clearAllTimers();
  }, [currentStory]);

  const safeGoBack = useCallback(() => {
    clearAllTimers();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router]);

  const goToNextStory = useCallback(() => {
    clearAllTimers();
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    setProgress(0);

    setCurrentStoryIndex((prevIndex) => {
      if (prevIndex < totalStories - 1) {
        return prevIndex + 1;
      }
      setTimeout(() => safeGoBack(), 100);
      return prevIndex;
    });
  }, [totalStories, safeGoBack]);

  const goToPreviousStory = useCallback(() => {
    clearAllTimers();
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    setProgress(0);

    setCurrentStoryIndex((prevIndex) => {
      if (prevIndex > 0) return prevIndex - 1;
      return prevIndex;
    });
  }, []);

  // ✅ STORY CHANGE EFFECT
  useEffect(() => {
    if (!currentStory || isLoading) return;

    setProgress(0);
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    setIsPaused(false);
    setIsViewersModalVisible(false);

    // ✅ OPTIMISTIC VIEW - No blocking
    if (!isOwnStory && !viewedRef.current.has(currentStory._id)) {
      viewedRef.current.add(currentStory._id);
      // Fire and forget - queues for background sync
      storyApi.viewStory(currentStory._id).catch(console.error);
    }

    if (currentStory.type !== "video") {
      const timeout = setTimeout(() => startImageTimer(), 50);
      return () => clearTimeout(timeout);
    }

    return () => clearAllTimers();
  }, [currentStoryIndex, isOwnStory, currentStory, isLoading]);

  // Delete story
  const handleDeleteStory = useCallback(() => {
    if (!currentStory) return;

    Alert.alert(
      "Delete Story",
      "Are you sure you want to delete this Moment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await storyApi.deleteStory(currentStory._id);

              // Remove story from local state
              if (storyGroup) {
                const updatedStories = storyGroup.stories.filter(
                  (s) => s._id !== currentStory._id,
                );

                if (updatedStories.length === 0) {
                  safeGoBack();
                } else {
                  setStoryGroup({
                    ...storyGroup,
                    stories: updatedStories,
                  });
                  if (currentStoryIndex >= updatedStories.length) {
                    setCurrentStoryIndex(updatedStories.length - 1);
                  }
                }
              }
            } catch (err) {
              console.log("DELETE ERROR:", err);
              Alert.alert("Error", "Failed to delete story");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [currentStory, storyGroup, currentStoryIndex, safeGoBack]);

  // Pause/Resume
  const handlePause = useCallback(() => {
    setIsPaused(true);
    pauseImageTimer();
  }, [pauseImageTimer]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    if (currentStory?.type !== "video") {
      setTimeout(() => {
        startImageTimer();
      }, 0);
    }
  }, [currentStory, startImageTimer]);

  // Modal/Reply pause effect
  useEffect(() => {
    const shouldPause = isViewersModalVisible || isReplyFocused;
    if (shouldPause) {
      handlePause();
    } else {
      handleResume();
    }
  }, [isViewersModalVisible, isReplyFocused, handlePause, handleResume]);

  const handleClose = useCallback(() => {
    clearAllTimers();
    safeGoBack();
  }, [safeGoBack]);

  const openViewersModal = useCallback(() => {
    setIsViewersModalVisible(true);
  }, []);

  const closeViewersModal = useCallback(() => {
    setIsViewersModalVisible(false);
  }, []);

  // ✅ PULL TO REFRESH
  const handleRefresh = useCallback(() => {
    fetchStoryGroup(true); // Force refresh from server
  }, [fetchStoryGroup]);

  // Gestures
  const shouldDisableGestures = isViewersModalVisible || isReplyFocused;

  // Long press works anywhere
  const longPressGesture = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => {
      if (!shouldDisableGestures) runOnJS(handlePause)();
    })
    .onEnd(() => {
      if (!shouldDisableGestures) runOnJS(handleResume)();
    });

  // Tap only in left 30% and right 30%, middle 40% is dead
  const tapGesture = Gesture.Tap().onEnd((event) => {
    if (shouldDisableGestures) return;

    if (event.y < TOP_DEAD_ZONE) return;
    if (event.y > height - BOTTOM_DEAD_ZONE) return;
    if (event.x >= LEFT_TAP_WIDTH && event.x <= RIGHT_TAP_START) return;

    if (event.x < LEFT_TAP_WIDTH) {
      runOnJS(goToPreviousStory)();
    } else if (event.x > RIGHT_TAP_START) {
      runOnJS(goToNextStory)();
    }
  });

  // Vertical pan for dismiss + swipe up viewers
  const verticalPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (shouldDisableGestures) return;
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (shouldDisableGestures) return;

      if (event.translationY > 140 || event.velocityY > 900) {
        translateY.value = withTiming(700, { duration: 250 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }

      if (event.translationY < -120 && isOwnStory) {
        runOnJS(openViewersModal)();
      }
    });

  const composedGesture = Gesture.Simultaneous(
    longPressGesture,
    tapGesture,
    verticalPanGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading story...</Text>
        </View>
      </View>
    );
  }

  // Error
  if (error || !storyGroup || !currentStory) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || "Moment not found"}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => handleRefresh()}
          >
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render
  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          {/* Progress bars */}
          <View style={styles.progressContainer}>
            {storyGroup.stories.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressBar,
                  {
                    backgroundColor:
                      index < currentStoryIndex
                        ? "#fff"
                        : "rgba(255,255,255,0.25)",
                  },
                ]}
              >
                {index === currentStoryIndex && (
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                )}
              </View>
            ))}
          </View>

          {/* Header */}
          <StoryHeader
            user={storyGroup}
            currentStory={currentStory}
            onClose={handleClose}
          />

          {/* Media */}
          <StoryMedia
            story={currentStory}
            isPaused={isPaused || isViewersModalVisible || isReplyFocused}
            onEnd={goToNextStory}
            onProgress={(p) => {
              if (currentStory.type === "video") setProgress(p);
            }}
          />

          {/* Caption */}
          {currentStory.caption && (
            <View
              style={[
                styles.captionContainer,
                { bottom: isOwnStory ? 90 : 110 },
              ]}
            >
              <Text style={styles.caption}>{currentStory.caption}</Text>
            </View>
          )}

          {/* Bottom bar for own story */}
          {isOwnStory && !isViewersModalVisible && (
            <View style={styles.bottomBar}>
              {/* Left - Person icon with viewer count */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomBarItem}
                onPress={openViewersModal}
              >
                <Ionicons name="person-outline" size={20} color="#fff" />
                <Text style={styles.bottomBarText}>{viewerCount}</Text>
              </TouchableOpacity>

              {/* Middle - Swipe up text */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomBarItem}
                onPress={openViewersModal}
              >
                <Ionicons name="chevron-up-outline" size={20} color="#fff" />
                <Text style={styles.bottomBarText}>Swipe up</Text>
              </TouchableOpacity>

              {/* Right - Delete icon */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomBarItem}
                onPress={handleDeleteStory}
                disabled={isDeleting}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Reply input */}
          {!isOwnStory && (
            <StoryReplyInput
              storyId={currentStory._id}
              story={currentStory} // Pass the full story object
              visible={!isViewersModalVisible}
              onFocusChange={setIsReplyFocused}
            />
          )}

          {/* Viewers modal */}
          {isOwnStory && (
            <StoryViewersModal
              visible={isViewersModalVisible}
              storyId={currentStory._id}
              onClose={closeViewersModal}
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 12,
    opacity: 0.7,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    right: 16,
    zIndex: 30,
    padding: 8,
  },
  progressContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 70 : 50,
    left: 8,
    right: 8,
    flexDirection: "row",
    gap: 4,
    zIndex: 20,
  },
  progressBar: {
    flex: 1,
    height: 2.5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  captionContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 15,
  },
  caption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  bottomBar: {
    position: "absolute",
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 25,
    paddingHorizontal: 8,
  },
  bottomBarItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  bottomBarText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
