// app/components/chat/AudioPlayer.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../../constants/ipConstants";

interface AudioPlayerProps {
  audioUrl: string;
  duration: number;
  isOwnMessage: boolean;
  messageId: string;
  onPlayed?: (messageId: string) => void;
}

export default function AudioPlayer({
  audioUrl,
  duration,
  isOwnMessage,
  messageId,
  onPlayed,
}: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlayed, setIsPlayed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const waveAnimations = useRef(
    [...Array(7)].map(() => new Animated.Value(0)),
  ).current;

  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isResettingRef = useRef(false);
  const isFinishedRef = useRef(false);

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Waveform animation when playing
  useEffect(() => {
    if (isPlaying) {
      // Create staggered animations for each bar (Instagram-style)
      const animations = waveAnimations.map((anim, index) => {
        return Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 400 + index * 30,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 400 + index * 30,
            useNativeDriver: false,
          }),
        ]);
      });

      Animated.loop(Animated.parallel(animations)).start();
    } else {
      // Stop all animations and reset
      waveAnimations.forEach((anim) => anim.setValue(0));
    }
  }, [isPlaying]);

  // Play button press animation
  const animateButtonPress = async () => {
    // Scale down
    Animated.spring(buttonScaleAnim, {
      toValue: 0.9,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // Scale back up after delay
    setTimeout(() => {
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  // Construct full URL safely
  const getFullAudioUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    let cleanUrl = url.startsWith("/") ? url : `/${url}`;
    return `${API_BASE_URL}${cleanUrl}`;
  };

  const fullAudioUrl = getFullAudioUrl(audioUrl);

  // Load sound when URL changes
  useEffect(() => {
    if (fullAudioUrl) {
      loadSound();
    }
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [audioUrl]);

  const loadSound = async () => {
    if (!fullAudioUrl) {
      setError("No audio URL");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: fullAudioUrl },
        { shouldPlay: false },
      );

      setSound(newSound);

      // Get actual duration
      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setTotalDuration(status.durationMillis / 1000);
      }

      // Set up playback status listener with reliable completion detection
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        // Update current time when playing
        if (status.isPlaying) {
          setCurrentTime(status.positionMillis / 1000);
        }

        // Reliable completion detection
        const isComplete =
          status.didJustFinish ||
          (status.durationMillis &&
            status.positionMillis >= status.durationMillis - 50 &&
            !status.isPlaying);

        if (isComplete && !isResettingRef.current && !isFinishedRef.current) {
          isFinishedRef.current = true;
          resetAudio();
        }
      });
    } catch (error: any) {
      console.error("Error loading sound:", error.message);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startProgressTracking = () => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
    }

    playbackIntervalRef.current = setInterval(async () => {
      if (sound && !isResettingRef.current) {
        try {
          const status = await sound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            const newTime = status.positionMillis / 1000;
            setCurrentTime(newTime);

            // Additional completion check
            if (
              status.durationMillis &&
              newTime >= status.durationMillis / 1000 - 0.05
            ) {
              if (!isResettingRef.current && !isFinishedRef.current) {
                isFinishedRef.current = true;
                resetAudio();
              }
            }
          }
        } catch (error) {
          console.error("Error getting status:", error);
        }
      }
    }, 100);
  };

  const resetAudio = async () => {
    if (isResettingRef.current) return;
    isResettingRef.current = true;

    try {
      if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.setPositionAsync(0);
        }
      }

      setIsPlaying(false);
      setCurrentTime(0);

      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }

      setTimeout(() => {
        isFinishedRef.current = false;
      }, 100);
    } catch (error) {
      console.error("Error resetting audio:", error);
    } finally {
      isResettingRef.current = false;
    }
  };

  const togglePlayback = async () => {
    // Trigger button animation
    animateButtonPress();

    if (error) {
      await loadSound();
      return;
    }

    if (!sound) {
      await loadSound();
      return;
    }

    isFinishedRef.current = false;

    if (isPlaying) {
      // Pause
      try {
        await sound.pauseAsync();
        setIsPlaying(false);
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
          playbackIntervalRef.current = null;
        }
      } catch (error) {
        console.error("Error pausing:", error);
      }
    } else {
      // Play
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (
            status.durationMillis &&
            status.positionMillis >= status.durationMillis - 100
          ) {
            await sound.setPositionAsync(0);
            setCurrentTime(0);
          }

          await sound.playAsync();
          setIsPlaying(true);
          startProgressTracking();

          if (!isPlayed && onPlayed) {
            setIsPlayed(true);
            onPlayed(messageId);
          }
        }
      } catch (err) {
        console.error("Error playing sound:", err);
        await loadSound();
        if (sound) {
          try {
            await sound.playAsync();
            setIsPlaying(true);
            startProgressTracking();
          } catch (playError) {
            console.error("Error playing after reload:", playError);
          }
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Animated waveform bars with Instagram-style pulsing
  const renderWaveform = () => {
    const bars = [10, 18, 14, 22, 10, 16, 12];

    return bars.map((height, index) => {
      const scaleY = waveAnimations[index].interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.6],
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.waveBar,
            {
              height,
              transform: [{ scaleY }],
              backgroundColor: isOwnMessage
                ? "rgba(255,255,255,0.8)"
                : "#007AFF",
            },
          ]}
        />
      );
    });
  };

  if (isLoading) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.audioIconWrap,
            isOwnMessage && styles.ownAudioIconWrap,
          ]}
        >
          <ActivityIndicator
            size="small"
            color={isOwnMessage ? "#fff" : "#007AFF"}
          />
        </View>
        <View style={styles.waveformContainer}>
          {[10, 18, 14, 22, 10, 16, 12].map((h, i) => (
            <View
              key={i}
              style={[styles.waveBar, { height: h, opacity: 0.3 }]}
            />
          ))}
        </View>
        <Text style={[styles.audioLabel, isOwnMessage && styles.ownAudioLabel]}>
          Loading...
        </Text>
      </Animated.View>
    );
  }

  if (error) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.audioIconWrap,
            isOwnMessage && styles.ownAudioIconWrap,
          ]}
        >
          <Ionicons name="mic-off" size={16} color="#FF3B30" />
        </View>
        <Text style={styles.errorText}>Audio unavailable</Text>
      </Animated.View>
    );
  }

  const displayDuration = totalDuration > 0 ? totalDuration : duration;
  const displayCurrentTime = currentTime > 0 ? currentTime : 0;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.playButton,
          {
            transform: [{ scale: buttonScaleAnim }],
          },
        ]}
      >
        <TouchableOpacity
          onPress={togglePlayback}
          activeOpacity={1}
          style={styles.playButtonInner}
        >
          <View
            style={[
              styles.audioIconWrap,
              isOwnMessage && styles.ownAudioIconWrap,
            ]}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={14}
              color={isOwnMessage ? "#fff" : "#007AFF"}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        onPress={togglePlayback}
        activeOpacity={0.7}
        style={styles.waveformTouchable}
      >
        <View style={styles.waveformContainer}>{renderWaveform()}</View>
      </TouchableOpacity>

      <View style={styles.timeContainer}>
        <Text style={[styles.audioLabel, isOwnMessage && styles.ownAudioLabel]}>
          {formatTime(displayCurrentTime)} / {formatTime(displayDuration)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  playButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonInner: {
    justifyContent: "center",
    alignItems: "center",
  },
  waveformTouchable: {
    flex: 1,
  },
  audioIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  ownAudioIconWrap: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  audioLabel: {
    fontSize: 12,
    color: "#000",
    opacity: 0.85,
    fontFamily: "SofiaSans-Regular",
  },
  ownAudioLabel: {
    color: "#fff",
  },
  errorText: {
    fontSize: 12,
    color: "#FF3B30",
    fontFamily: "SofiaSans-Regular",
  },
});
