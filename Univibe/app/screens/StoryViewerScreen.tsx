import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from "react";
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
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";

import StoryHeader from "../components/story/StoryHeader";
import StoryMedia from "../components/story/StoryMedia";
import StoryReplyInput from "../components/story/StoryReplyInput";
import StoryViewersModal from "../components/story/StoryViewersModal";
import StoryCarousel from "../components/story/StoryCarousel";

import storyApi from "../../lib/services/storyApi";
import { useAuth } from "../../lib/contexts/AuthContext";

import type { StoryGroup, Story } from "../../lib/services/storyApi";

// =============================================================================
// Constants
// =============================================================================

const { width, height } = Dimensions.get("window");
const IMAGE_STORY_DURATION = 10000;

const TOP_DEAD_ZONE = Platform.OS === "ios" ? 140 : 120;
const BOTTOM_DEAD_ZONE = Platform.OS === "ios" ? 130 : 110;
const LEFT_TAP_WIDTH = width * 0.3;
const RIGHT_TAP_START = width * 0.7;

// =============================================================================
// Progress Bars Component
// =============================================================================

interface ProgressBarsProps {
  group: StoryGroup;
  currentStoryIndex: number;
  activeProgress: SharedValue<number>;
  isActive: boolean;
}

const ProgressBars = memo(
  ({
    group,
    currentStoryIndex,
    activeProgress,
    isActive,
  }: ProgressBarsProps) => {
    const dummyProgress = useSharedValue(0);
    const progress = isActive ? activeProgress : dummyProgress;

    return (
      <View style={styles.progressContainer}>
        {group.stories.map((_, storyIdx) => (
          <View
            key={storyIdx}
            style={[
              styles.progressBar,
              {
                backgroundColor:
                  storyIdx < currentStoryIndex
                    ? "#fff"
                    : "rgba(255,255,255,0.25)",
              },
            ]}
          >
            {storyIdx === currentStoryIndex && (
              <ProgressFill progress={progress} />
            )}
          </View>
        ))}
      </View>
    );
  },
);

ProgressBars.displayName = "ProgressBars";

// =============================================================================
// Progress Fill Component
// =============================================================================

interface ProgressFillProps {
  progress: SharedValue<number>;
}

const ProgressFill = memo(({ progress }: ProgressFillProps) => {
  const progressStyle = useAnimatedStyle(() => {
    const val = progress.value || 0;
    return {
      width: `${Math.max(0, Math.min(val, 1)) * 100}%`,
    };
  });

  return <Animated.View style={[styles.progressFill, progressStyle]} />;
});

ProgressFill.displayName = "ProgressFill";

// =============================================================================
// Memoized StoryMedia Wrapper to prevent remounting
// =============================================================================

interface StoryMediaWrapperProps {
  story: Story;
  isPaused: boolean;
  onEnd: () => void;
  onProgress: (progress: number) => void;
}

const MemoizedStoryMedia = memo(
  ({ story, isPaused, onEnd, onProgress }: StoryMediaWrapperProps) => (
    <StoryMedia
      story={story}
      isPaused={isPaused}
      onEnd={onEnd}
      onProgress={onProgress}
    />
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.story._id === nextProps.story._id &&
      prevProps.story.type === nextProps.story.type &&
      prevProps.isPaused === nextProps.isPaused
    );
  },
);

MemoizedStoryMedia.displayName = "MemoizedStoryMedia";

// =============================================================================
// Main Screen Component
// =============================================================================

export default function StoryViewerScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const params = useLocalSearchParams<{
    userId: string;
    userName: string;
    storyId?: string;
    initialStoryId?: string;
    groupIndex?: string;
  }>();

  // ---------------------------------------------------------------------------
  // ARCHITECTURAL FIXED STATE FIELDS
  // ---------------------------------------------------------------------------
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewState, setViewState] = useState<{
    groups: StoryGroup[];
    groupIndex: number;
    storyIndex: number;
  }>({
    groups: [],
    groupIndex: params.groupIndex ? parseInt(params.groupIndex, 10) : 0,
    storyIndex: 0,
  });

  const [isPaused, setIsPaused] = useState(false);
  const [isViewersModalVisible, setIsViewersModalVisible] = useState(false);
  const [isReplyFocused, setIsReplyFocused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const progressShared = useSharedValue(0);

  // ---------------------------------------------------------------------------
  // WORKLET SAFETY INTERFACE (Prevents serializing React Refs)
  // ---------------------------------------------------------------------------
  const isGesturesDisabledShared = useSharedValue(false);
  const isOwnStoryShared = useSharedValue(false);

  useEffect(() => {
    isGesturesDisabledShared.value = isViewersModalVisible || isReplyFocused;
  }, [isViewersModalVisible, isReplyFocused]);

  // ---------------------------------------------------------------------------
  // SYSTEM STABLE CONTROLLER REFS
  // ---------------------------------------------------------------------------
  const currentStoryIdRef = useRef<string | null>(null);
  const currentGroupIdRef = useRef<string | null>(null);
  const previousStoryIdRef = useRef<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef(0);
  const remainingTimeRef = useRef(IMAGE_STORY_DURATION);
  const viewedRef = useRef(new Set<string>());
  const unsubViewSyncRef = useRef<(() => void) | null>(null);
  const translateY = useSharedValue(0);
  const isGoingBackRef = useRef(false);

  // Derived references
  const {
    groups: allGroups,
    groupIndex: currentGroupIndex,
    storyIndex: currentStoryIndex,
  } = viewState;

  const currentGroup = allGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];

  const totalGroups = allGroups.length;
  const isOwnStory = useMemo(
    () => currentGroup?.userId === user?.id,
    [currentGroup, user],
  );

  // Keep our worklet shared flag synced with the structural data state
  useEffect(() => {
    isOwnStoryShared.value = isOwnStory;
  }, [isOwnStory]);

  const viewerCount = useMemo(
    () => (currentStory ? storyApi.getUniqueViewerCount(currentStory) : 0),
    [currentStory],
  );

  const updateCurrentStoryRefs = useCallback(
    (storyId: string | null, groupId: string | null) => {
      previousStoryIdRef.current = currentStoryIdRef.current;
      currentStoryIdRef.current = storyId;
      currentGroupIdRef.current = groupId;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // LIGHTWEIGHT AGGRESSIVE NEIGHBOR PRELOADER
  // ---------------------------------------------------------------------------
  const performPreloadMatrix = useCallback(
    (groups: StoryGroup[], cGIdx: number, cSIdx: number) => {
      if (!groups || groups.length === 0) return;

      const targets: string[] = [];
      const currentGroupItem = groups[cGIdx];

      if (currentGroupItem?.stories) {
        if (cSIdx + 1 < currentGroupItem.stories.length) {
          targets.push(currentGroupItem.stories[cSIdx + 1].mediaUrl);
        }
        if (cSIdx - 1 >= 0) {
          targets.push(currentGroupItem.stories[cSIdx - 1].mediaUrl);
        }
      }

      if (cGIdx + 1 < groups.length && groups[cGIdx + 1]?.stories?.[0]) {
        targets.push(groups[cGIdx + 1].stories[0].mediaUrl);
      }
      if (cGIdx - 1 >= 0 && groups[cGIdx - 1]?.stories?.[0]) {
        targets.push(groups[cGIdx - 1].stories[0].mediaUrl);
      }

      requestAnimationFrame(() => {
        targets.forEach((url) => {
          if (url) {
            try {
              Image?.prefetch?.(url);
            } catch (_) {}
          }
        });
      });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // DATA HYDRATION FLOW
  // ---------------------------------------------------------------------------
  const fetchAllGroups = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await storyApi.getStories(1, 50, forceRefresh);

        if (!response.success || !response.data || response.data.length === 0) {
          setError("No stories available");
          setIsLoading(false);
          setIsInitialized(true);
          return;
        }

        const dataArray = response.data;
        let startGroupIndex = 0;
        const targetUserId = params.userId;

        if (targetUserId) {
          const foundIndex = dataArray.findIndex(
            (g: StoryGroup) => g.userId === targetUserId,
          );
          if (foundIndex !== -1) startGroupIndex = foundIndex;
        } else if (params.groupIndex) {
          startGroupIndex = parseInt(params.groupIndex, 10);
        }

        startGroupIndex = Math.max(
          0,
          Math.min(startGroupIndex, dataArray.length - 1),
        );
        const startGroup = dataArray[startGroupIndex];
        let targetStoryIndex = 0;

        if (startGroup?.stories) {
          const sortedStories = [...startGroup.stories].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );

          startGroup.stories = sortedStories;

          const targetStoryId = params.initialStoryId || params.storyId;
          if (targetStoryId) {
            const foundIndex = sortedStories.findIndex(
              (s) => s._id === targetStoryId,
            );
            targetStoryIndex = foundIndex !== -1 ? foundIndex : 0;
          } else {
            const firstUnseenIndex = sortedStories.findIndex(
              (s) => !s.hasCurrentUserViewed,
            );
            targetStoryIndex = firstUnseenIndex >= 0 ? firstUnseenIndex : 0;
          }
        }

        if (startGroup && startGroup.stories[targetStoryIndex]) {
          const targetStoryObj = startGroup.stories[targetStoryIndex];
          updateCurrentStoryRefs(targetStoryObj._id, startGroup.userId);
        }

        setViewState({
          groups: dataArray,
          groupIndex: startGroupIndex,
          storyIndex: targetStoryIndex,
        });

        performPreloadMatrix(dataArray, startGroupIndex, targetStoryIndex);

        setIsInitialized(true);
        setIsPaused(false);
        setIsLoading(false);
      } catch (err) {
        console.log("FETCH STORIES ERROR:", err);
        setError("Failed to load stories");
        setIsLoading(false);
        setIsInitialized(true);
      }
    },
    [
      params.userId,
      params.initialStoryId,
      params.storyId,
      params.groupIndex,
      updateCurrentStoryRefs,
      performPreloadMatrix,
    ],
  );

  useEffect(() => {
    fetchAllGroups(false);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAllGroups]);

  // ---------------------------------------------------------------------------
  // REACTIVE CACHE VIEW SYNC DEEP CAPTURING LIFECYCLE
  // ---------------------------------------------------------------------------
  useEffect(() => {
    unsubViewSyncRef.current = storyApi.onViewSyncComplete(
      (storyId: string, uniqueViewerCount: number) => {
        setViewState((prev) => {
          const hasStory = prev.groups.some((g) =>
            g.stories.some((s) => s._id === storyId),
          );
          if (!hasStory) return prev;

          const updatedGroups = prev.groups.map((group) => {
            const targetStoryIndex = group.stories.findIndex(
              (s) => s._id === storyId,
            );
            if (targetStoryIndex === -1) return group;

            const updatedStories = group.stories.map((story, idx) => {
              if (idx === targetStoryIndex) {
                return {
                  ...story,
                  uniqueViewersCount: uniqueViewerCount,
                  hasCurrentUserViewed: true,
                };
              }
              return story;
            });

            return {
              ...group,
              stories: updatedStories,
              hasUnseen: updatedStories.some((s) => !s.hasCurrentUserViewed),
            };
          });

          return {
            ...prev,
            groups: updatedGroups,
          };
        });
      },
    );

    return () => {
      if (unsubViewSyncRef.current) unsubViewSyncRef.current();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // CORE NAVIGATION AND TIMERS
  // ---------------------------------------------------------------------------
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

  const safeGoBack = useCallback(() => {
    clearAllTimers();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router, clearAllTimers]);

  const goToNextStory = useCallback(() => {
    clearAllTimers();
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    progressShared.value = 0;

    setViewState((prev) => {
      const { groupIndex, storyIndex, groups } = prev;
      const currentGroupItem = groups[groupIndex];

      if (
        currentGroupItem &&
        storyIndex < currentGroupItem.stories.length - 1
      ) {
        const nextStoryIndex = storyIndex + 1;
        performPreloadMatrix(groups, groupIndex, nextStoryIndex);
        return { ...prev, storyIndex: nextStoryIndex };
      }

      if (groupIndex < groups.length - 1) {
        const nextGroupIndex = groupIndex + 1;
        const nextGroup = groups[nextGroupIndex];
        let nextStoryTargetIndex = 0;

        if (nextGroup?.stories) {
          const sortedStories = [...nextGroup.stories].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          nextGroup.stories = sortedStories;
          const firstUnseenIndex = sortedStories.findIndex(
            (s) => !s.hasCurrentUserViewed,
          );
          nextStoryTargetIndex = firstUnseenIndex >= 0 ? firstUnseenIndex : 0;
        }

        performPreloadMatrix(groups, nextGroupIndex, nextStoryTargetIndex);
        return {
          ...prev,
          groupIndex: nextGroupIndex,
          storyIndex: nextStoryTargetIndex,
        };
      }

      setTimeout(() => safeGoBack(), 30);
      return prev;
    });
  }, [clearAllTimers, safeGoBack, performPreloadMatrix]);

  const goToPreviousStory = useCallback(() => {
    isGoingBackRef.current = true;
    clearAllTimers();
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    progressShared.value = 0;

    setViewState((prev) => {
      const { groupIndex, storyIndex, groups } = prev;

      // Go back within current group
      if (storyIndex > 0) {
        const prevStoryIndex = storyIndex - 1;
        performPreloadMatrix(groups, groupIndex, prevStoryIndex);
        return { ...prev, storyIndex: prevStoryIndex };
      }

      // Go to previous group's LAST story
      if (groupIndex > 0) {
        const prevGroupIndex = groupIndex - 1;
        const prevGroup = groups[prevGroupIndex];
        const lastStoryIndex = Math.max(
          0,
          (prevGroup?.stories?.length || 1) - 1,
        );

        performPreloadMatrix(groups, prevGroupIndex, lastStoryIndex);
        return {
          ...prev,
          groupIndex: prevGroupIndex,
          storyIndex: lastStoryIndex,
        };
      }

      return prev;
    });
  }, [clearAllTimers, progressShared, performPreloadMatrix]);

  const startImageTimer = useCallback(() => {
    clearAllTimers();
    timerStartRef.current = Date.now();
    const duration = remainingTimeRef.current;

    timeoutRef.current = setTimeout(() => {
      if (currentStoryIdRef.current) {
        goToNextStory();
      }
    }, duration);

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const p = 1 - (duration - elapsed) / IMAGE_STORY_DURATION;
      progressShared.value = Math.max(0, Math.min(p, 1));
    }, 16);
  }, [goToNextStory, clearAllTimers, progressShared]);

  const pauseImageTimer = useCallback(() => {
    if (currentStoryIdRef.current) {
      const elapsed = Date.now() - timerStartRef.current;
      remainingTimeRef.current = Math.max(
        0,
        remainingTimeRef.current - elapsed,
      );
    }
    clearAllTimers();
  }, [clearAllTimers]);

  useEffect(() => {
    if (!currentStory || isLoading || !isInitialized) return;

    updateCurrentStoryRefs(currentStory._id, currentGroup?.userId || null);

    progressShared.value = 0;
    remainingTimeRef.current = IMAGE_STORY_DURATION;
    setIsPaused(false);
    setIsViewersModalVisible(false);

    if (!isOwnStory && !viewedRef.current.has(currentStory._id)) {
      viewedRef.current.add(currentStory._id);
      storyApi.viewStory(currentStory._id).catch(console.error);
    }

    if (currentStory.type === "video") {
      isGoingBackRef.current = false;
      return () => clearAllTimers();
    }

    // Fast start — no delay for backward navigation
    const delay = 30;
    isGoingBackRef.current = false;

    const timeout = setTimeout(() => {
      startImageTimer();
    }, delay);

    return () => clearTimeout(timeout);
  }, [
    currentStory,
    isLoading,
    isInitialized,
    isOwnStory,
    currentGroup,
    updateCurrentStoryRefs,
    startImageTimer,
    clearAllTimers,
    progressShared,
  ]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    pauseImageTimer();
  }, [pauseImageTimer]);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    const activeStory =
      allGroups[currentGroupIndex]?.stories[currentStoryIndex];
    if (activeStory && activeStory.type !== "video") {
      startImageTimer();
    }
  }, [allGroups, currentGroupIndex, currentStoryIndex, startImageTimer]);

  useEffect(() => {
    const shouldPause = isViewersModalVisible || isReplyFocused;
    if (shouldPause) {
      handlePause();
    } else {
      handleResume();
    }
  }, [isViewersModalVisible, isReplyFocused, handlePause, handleResume]);

  // ---------------------------------------------------------------------------
  // INTERACTION HANDLERS
  // ---------------------------------------------------------------------------
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

              setViewState((prev) => {
                const { groups, groupIndex, storyIndex } = prev;
                const updatedStories = groups[groupIndex].stories.filter(
                  (s) => s._id !== currentStory._id,
                );

                if (updatedStories.length === 0) {
                  const updatedGroups = groups.filter(
                    (_, i) => i !== groupIndex,
                  );
                  if (updatedGroups.length === 0) {
                    setTimeout(() => safeGoBack(), 30);
                    return prev;
                  }
                  const newGroupIndex = Math.min(
                    groupIndex,
                    updatedGroups.length - 1,
                  );
                  return {
                    groups: updatedGroups,
                    groupIndex: newGroupIndex,
                    storyIndex: 0,
                  };
                }

                const updatedGroups = [...groups];
                updatedGroups[groupIndex] = {
                  ...groups[groupIndex],
                  stories: updatedStories,
                };
                const newStoryIndex = Math.min(
                  storyIndex,
                  updatedStories.length - 1,
                );
                return {
                  ...prev,
                  groups: updatedGroups,
                  storyIndex: newStoryIndex,
                };
              });
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
  }, [currentStory, safeGoBack]);

  const handleClose = useCallback(() => {
    clearAllTimers();
    safeGoBack();
  }, [safeGoBack, clearAllTimers]);

  const openViewersModal = useCallback(
    () => setIsViewersModalVisible(true),
    [],
  );
  const closeViewersModal = useCallback(
    () => setIsViewersModalVisible(false),
    [],
  );

  const handleGroupChange = useCallback(
    (newIndex: number) => {
      setViewState((prev) => {
        if (newIndex === prev.groupIndex) return prev;
        const group = prev.groups[newIndex];
        if (!group) return prev;

        const isForward = newIndex > prev.groupIndex;

        let targetStoryIdx: number;
        if (isForward) {
          const firstUnseenIndex = group.stories.findIndex(
            (s) => !s.hasCurrentUserViewed,
          );
          targetStoryIdx = firstUnseenIndex >= 0 ? firstUnseenIndex : 0;
        } else {
          isGoingBackRef.current = true;
          targetStoryIdx = Math.max(0, group.stories.length - 1);
        }

        clearAllTimers();
        remainingTimeRef.current = IMAGE_STORY_DURATION;
        progressShared.value = 0;

        return {
          ...prev,
          groupIndex: newIndex,
          storyIndex: targetStoryIdx,
        };
      });
    },
    [clearAllTimers, progressShared],
  );

  // ---------------------------------------------------------------------------
  // GESTURES SETUP (Warnings completely mitigated by SharedValue isolation)
  // ---------------------------------------------------------------------------
  const longPressGesture = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => {
      if (!isGesturesDisabledShared.value) runOnJS(handlePause)();
    })
    .onEnd(() => {
      if (!isGesturesDisabledShared.value) runOnJS(handleResume)();
    });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    if (isGesturesDisabledShared.value) return;
    if (event.y < TOP_DEAD_ZONE) return;
    if (event.y > height - BOTTOM_DEAD_ZONE) return;
    if (event.x >= LEFT_TAP_WIDTH && event.x <= RIGHT_TAP_START) return;

    if (event.x < LEFT_TAP_WIDTH) {
      runOnJS(goToPreviousStory)();
    } else if (event.x > RIGHT_TAP_START) {
      runOnJS(goToNextStory)();
    }
  });

  const verticalPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (isGesturesDisabledShared.value) return;
      if (event.translationY > 0) translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (isGesturesDisabledShared.value) return;
      if (event.translationY > 140 || event.velocityY > 900) {
        translateY.value = withTiming(700, { duration: 250 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(0);
      }
      if (event.translationY < -120 && isOwnStoryShared.value) {
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

  // ---------------------------------------------------------------------------
  // HIGH-PERFORMANCE GROUP RENDERING MATRIX
  // ---------------------------------------------------------------------------
  const renderGroupPage = useCallback(
    (group: StoryGroup, index: number) => {
      const isActiveGroup = index === currentGroupIndex;
      const isNeighborGroup = Math.abs(index - currentGroupIndex) <= 1;

      const story = isActiveGroup
        ? group.stories[currentStoryIndex]
        : group.stories[0] || null;

      if (!story) return null;

      return (
        <View style={styles.groupPage} key={group.userId}>
          {isActiveGroup && (
            <ProgressBars
              group={group}
              currentStoryIndex={currentStoryIndex}
              activeProgress={progressShared}
              isActive={true}
            />
          )}

          <StoryHeader
            user={group}
            currentStory={story}
            onClose={handleClose}
          />

          {isActiveGroup ? (
            <MemoizedStoryMedia
              story={story}
              isPaused={isPaused || isViewersModalVisible || isReplyFocused}
              onEnd={goToNextStory}
              onProgress={(p) => {
                if (story.type === "video") {
                  progressShared.value = p;
                }
              }}
            />
          ) : isNeighborGroup ? (
            <View style={styles.inactiveMediaPlaceholder}>
              <StoryMedia
                story={story}
                isPaused={true}
                onEnd={() => {}}
                onProgress={() => {}}
              />
            </View>
          ) : (
            <View
              style={[
                styles.inactiveMediaPlaceholder,
                { backgroundColor: "#000" },
              ]}
            />
          )}

          {story.caption && isActiveGroup && (
            <View
              style={[
                styles.captionContainer,
                { bottom: isOwnStory ? 90 : 110 },
              ]}
            >
              <Text style={styles.caption}>{story.caption}</Text>
            </View>
          )}

          {isOwnStory && isActiveGroup && !isViewersModalVisible && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomBarItem}
                onPress={openViewersModal}
              >
                <Ionicons name="person-outline" size={20} color="#fff" />
                <Text style={styles.bottomBarText}>{viewerCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bottomBarItem}
                onPress={openViewersModal}
              >
                <Ionicons name="chevron-up-outline" size={20} color="#fff" />
                <Text style={styles.bottomBarText}>Swipe up</Text>
              </TouchableOpacity>
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

          {!isOwnStory && isActiveGroup && (
            <StoryReplyInput
              storyId={story._id}
              story={story}
              visible={!isViewersModalVisible}
              onFocusChange={setIsReplyFocused}
            />
          )}

          {isOwnStory && isActiveGroup && (
            <StoryViewersModal
              visible={isViewersModalVisible}
              storyId={story._id}
              onClose={closeViewersModal}
            />
          )}
        </View>
      );
    },
    [
      currentGroupIndex,
      currentStoryIndex,
      progressShared,
      isPaused,
      isViewersModalVisible,
      isReplyFocused,
      isOwnStory,
      viewerCount,
      goToNextStory,
      handleClose,
      openViewersModal,
      closeViewersModal,
      handleDeleteStory,
      isDeleting,
    ],
  );

  // ---------------------------------------------------------------------------
  // RENDERING ENGINE ENTRY
  // ---------------------------------------------------------------------------
  if (isLoading || !isInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading stories...</Text>
        </View>
      </View>
    );
  }

  if (error || !currentGroup || !currentStory) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error || "No stories found"}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchAllGroups(true)}
          >
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <StoryCarousel
            storyGroups={allGroups}
            currentGroupIndex={currentGroupIndex}
            onGroupChange={handleGroupChange}
          >
            {allGroups.map((group, index) => (
              <React.Fragment key={group.userId || `group-${index}`}>
                {renderGroupPage(group, index)}
              </React.Fragment>
            ))}
          </StoryCarousel>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#fff", fontSize: 14, marginTop: 12, opacity: 0.7 },
  errorText: { color: "#fff", fontSize: 16, marginBottom: 20 },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  captionContainer: { position: "absolute", left: 16, right: 16, zIndex: 15 },
  caption: { color: "#fff", fontSize: 14, lineHeight: 20 },
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
  bottomBarText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  groupPage: { width, height, backgroundColor: "#000" },
  inactiveMediaPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
