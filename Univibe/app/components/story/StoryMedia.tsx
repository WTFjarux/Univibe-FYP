import React, {
  memo,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../../constants/ipConstants";

const { width, height } = Dimensions.get("window");

// Instagram-like constants
const STORY_ASPECT_RATIO = 9 / 16; // Portrait mode (width/height)
const MAX_STORY_WIDTH = width;
const MAX_STORY_HEIGHT = height * 0.95; // 95% of screen height

interface StoryMediaProps {
  story: any;
  isPaused: boolean;
  onProgress?: (progress: number) => void;
  onDuration?: (duration: number) => void;
  onEnd?: () => void;
}

const StoryMedia = memo(
  ({ story, isPaused, onProgress, onDuration, onEnd }: StoryMediaProps) => {
    // ===== REFS =====
    const videoRef = useRef<Video>(null);
    const isMountedRef = useRef(true);
    const isPlayingRef = useRef(false);
    const onProgressRef = useRef(onProgress);
    const onDurationRef = useRef(onDuration);
    const onEndRef = useRef(onEnd);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ===== STATE =====
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");

    // ===== MEMOIZED VALUES =====
    const isVideo = story?.type === "video";

    const mediaUrl = useMemo(() => {
      if (!story?.mediaUrl) return null;
      return story.mediaUrl.startsWith("http")
        ? story.mediaUrl
        : `${API_BASE_URL}${story.mediaUrl}`;
    }, [story?.mediaUrl, story?._id]);

    // Instagram-like fixed dimensions
    const storyDimensions = useMemo(() => {
      // Calculate dimensions maintaining 9:16 aspect ratio
      let storyWidth = MAX_STORY_WIDTH;
      let storyHeight = storyWidth / STORY_ASPECT_RATIO;

      // If height exceeds max, scale down proportionally
      if (storyHeight > MAX_STORY_HEIGHT) {
        storyHeight = MAX_STORY_HEIGHT;
        storyWidth = storyHeight * STORY_ASPECT_RATIO;
      }

      return {
        width: Math.floor(storyWidth),
        height: Math.floor(storyHeight),
      };
    }, []);

    // ===== EFFECTS =====

    // Update callback refs silently
    useEffect(() => {
      onProgressRef.current = onProgress;
    }, [onProgress]);

    useEffect(() => {
      onDurationRef.current = onDuration;
    }, [onDuration]);

    useEffect(() => {
      onEndRef.current = onEnd;
    }, [onEnd]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        isMountedRef.current = false;
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        // Clean up video resources
        if (videoRef.current) {
          videoRef.current.unloadAsync().catch(console.error);
        }
      };
    }, []);

    // Reset state when story changes
    useEffect(() => {
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
      setErrorMessage("");
    }, [story?._id]);

    // Pause/Resume video
    useEffect(() => {
      handlePauseResume();
    }, [isPaused, isVideo]);

    // Preload video for smoother playback
    useEffect(() => {
      if (isVideo && videoRef.current && story?._id && !hasError) {
        videoRef.current
          .loadAsync(
            { uri: mediaUrl! },
            {
              shouldPlay: false,
              isLooping: false,
              isMuted: false,
              volume: 1.0,
            },
            false,
          )
          .catch(console.error);
      }
    }, [story?._id, isVideo, mediaUrl, hasError]);

    // ===== HANDLERS =====
    const handlePauseResume = useCallback(async () => {
      if (!videoRef.current || !isVideo) return;

      try {
        if (isPaused) {
          await videoRef.current.pauseAsync();
          isPlayingRef.current = false;
        } else {
          await videoRef.current.playAsync();
          isPlayingRef.current = true;
        }
      } catch (error) {
        console.error("Playback control error:", error);
      }
    }, [isPaused, isVideo]);

    const handleImageLoad = useCallback(() => {
      if (!isMountedRef.current) return;
      setIsLoading(false);
    }, []);

    const handleVideoLoad = useCallback((status: any) => {
      if (!isMountedRef.current) return;

      if (status.isLoaded) {
        setIsLoading(false);
        if (status.durationMillis && onDurationRef.current) {
          onDurationRef.current(status.durationMillis);
        }
      }
    }, []);

    const handlePlaybackStatusUpdate = useCallback((status: any) => {
      if (!isMountedRef.current) return;

      if (status.isLoaded && status.durationMillis && onProgressRef.current) {
        const progress = status.positionMillis / status.durationMillis;
        onProgressRef.current(progress);

        if (status.didJustFinish && onEndRef.current) {
          onEndRef.current();
        }
      }
    }, []);

    const handleMediaError = useCallback(
      (error: any) => {
        if (!isMountedRef.current) return;

        console.error("Media load error:", error);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage("Failed to load media");

        // Auto-retry logic for videos (max 3 retries)
        if (retryCount < 3 && isVideo) {
          const newRetryCount = retryCount + 1;
          setRetryCount(newRetryCount);

          // Exponential backoff: 1s, 2s, 4s
          const delay = 1000 * Math.pow(2, retryCount);
          retryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              setHasError(false);
              setIsLoading(true);
              videoRef.current?.loadAsync({ uri: mediaUrl! }, {}, false);
            }
          }, delay);
        }
      },
      [isVideo, mediaUrl, retryCount],
    );

    const handleRetry = useCallback(() => {
      if (!isMountedRef.current) return;
      setHasError(false);
      setIsLoading(true);
      setRetryCount(0);
      setErrorMessage("");

      // Reload media
      if (isVideo && videoRef.current) {
        videoRef.current
          .loadAsync({ uri: mediaUrl! }, { shouldPlay: !isPaused }, false)
          .catch(console.error);
      }
      // Images will automatically retry via key change
    }, [isVideo, mediaUrl, isPaused]);

    // ===== RENDER HELPERS =====
    const renderSkeletonLoader = () => (
      <View style={[styles.skeletonContainer, storyDimensions]}>
        <View style={styles.skeletonContent}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.3)" />
        </View>
      </View>
    );

    const renderErrorState = () => (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    // ===== MAIN RENDER =====
    if (!story || !mediaUrl) {
      return (
        <View style={styles.container}>
          <View style={styles.centerContent}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={styles.errorText}>No content available</Text>
          </View>
        </View>
      );
    }

    if (hasError) {
      return renderErrorState();
    }

    return (
      <View style={styles.container}>
        {/* Main Media Layer - Instagram-like fixed dimensions */}
        <View style={styles.mediaContainer}>
          {/* Media with fixed Instagram-like dimensions */}
          <View style={[styles.mediaWrapper, storyDimensions]}>
            {isVideo ? (
              <Video
                ref={videoRef}
                source={{ uri: mediaUrl }}
                style={styles.mediaContent}
                resizeMode={ResizeMode.COVER}
                shouldPlay={!isPaused}
                isLooping={false}
                onLoad={handleVideoLoad}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onError={handleMediaError}
                progressUpdateIntervalMillis={16}
                useNativeControls={false}
                accessible={true}
                accessibilityLabel={story.caption || "Story video"}
                accessibilityRole="adjustable"
              />
            ) : (
              <Image
                source={{ uri: mediaUrl, cache: "force-cache" }}
                style={styles.mediaContent}
                resizeMode="cover"
                onLoad={handleImageLoad}
                onError={handleMediaError}
                accessible={true}
                accessibilityLabel={story.caption || "Story media"}
                accessibilityRole="image"
              />
            )}

            {/* Loading overlay */}
            {isLoading && !hasError && renderSkeletonLoader()}
          </View>
        </View>
      </View>
    );
  },
  // Custom comparison function for memo
  (prevProps: StoryMediaProps, nextProps: StoryMediaProps) => {
    return (
      prevProps.story?._id === nextProps.story?._id &&
      prevProps.isPaused === nextProps.isPaused &&
      prevProps.story?.mediaUrl === nextProps.story?.mediaUrl &&
      prevProps.story?.type === nextProps.story?.type
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Black background
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // Media Container - Centers the story content
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Fixed Instagram-like wrapper
  mediaWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
    // Subtle border for definition
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    // Shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },

  // Media content fills wrapper completely
  mediaContent: {
    width: "100%",
    height: "100%",
  },

  // Skeleton Loader Styles
  skeletonContainer: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 2,
  },
  skeletonContent: {
    justifyContent: "center",
    alignItems: "center",
  },

  // Error State Styles
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
    gap: 16,
  },
  errorText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
  },

  // Retry Button Styles
  retryButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default StoryMedia;
