// app/components/chat/AudioPlayer.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { API_BASE_URL } from "../../../../constants/ipConstants";
import AudioManager from "../../../../lib/utils/AudioManager";

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
  const waveLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Refs that shouldn't trigger re-renders
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isResettingRef = useRef(false);
  const isFinishedRef = useRef(false);
  const isUnloadingRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const messageIdRef = useRef(messageId);

  // Keep messageId ref updated
  useEffect(() => {
    messageIdRef.current = messageId;
  }, [messageId]);

  // Keep sound ref updated
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  // Fade-in animation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // 🔴 Stop wave animations
  const stopWaveAnimation = useCallback(() => {
    if (waveLoopRef.current) {
      waveLoopRef.current.stop();
      waveLoopRef.current = null;
    }
    waveAnimations.forEach((anim) => anim.setValue(0));
  }, [waveAnimations]);

  // 🔴 Start wave animations
  const startWaveAnimation = useCallback(() => {
    stopWaveAnimation();

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

    waveLoopRef.current = Animated.loop(Animated.parallel(animations));
    waveLoopRef.current.start();
  }, [waveAnimations, stopWaveAnimation]);

  // Pause audio and stop animations
  const pauseAudio = useCallback(async () => {
    setIsPlaying(false);
    stopWaveAnimation();

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    if (soundRef.current && !isUnloadingRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
        }
      } catch (error) {
        // Ignore
      }
    }
  }, [stopWaveAnimation]);

  // 🔴 Listen for other audio playing - stop this one immediately
  useEffect(() => {
    const unsubscribe = AudioManager.registerPlayCallback(
      (playingMessageId: string) => {
        if (playingMessageId !== messageIdRef.current) {
          // Immediately stop animations and update state
          setIsPlaying(false);
          stopWaveAnimation();
          if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
          }
          // Try to pause the actual sound (don't await)
          if (soundRef.current && !isUnloadingRef.current) {
            soundRef.current.pauseAsync().catch(() => {});
          }
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [stopWaveAnimation]); // Only depends on stopWaveAnimation

  // 🔴 Control wave animation based on isPlaying state
  useEffect(() => {
    if (isPlaying) {
      startWaveAnimation();
    } else {
      stopWaveAnimation();
    }
  }, [isPlaying, startWaveAnimation, stopWaveAnimation]);

  // Play button press animation
  const animateButtonPress = () => {
    Animated.spring(buttonScaleAnim, {
      toValue: 0.9,
      friction: 5,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }, 100);
  };

  // 🔴 Cleanup on unmount - only runs once
  useEffect(() => {
    return () => {
      isUnloadingRef.current = true;
      stopWaveAnimation();

      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }

      if (soundRef.current) {
        // Stop and unload sound on unmount
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        AudioManager.clearCurrentSound(messageIdRef.current);
      }
    };
  }, []); // Empty dependency array - runs only on unmount

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
      if (soundRef.current && !isUnloadingRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
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

      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
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

      soundRef.current = newSound;
      setSound(newSound);
      isUnloadingRef.current = false;

      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        setTotalDuration(status.durationMillis / 1000);
      }

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        if (status.isPlaying) {
          setCurrentTime(status.positionMillis / 1000);
        }

        const isComplete =
          status.didJustFinish ||
          (status.durationMillis &&
            status.positionMillis >= status.durationMillis - 50 &&
            !status.isPlaying);

        if (
          isComplete &&
          !isResettingRef.current &&
          !isFinishedRef.current &&
          !isUnloadingRef.current
        ) {
          isFinishedRef.current = true;
          resetAudio();
        }
      });
    } catch (error: any) {
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
      if (
        soundRef.current &&
        !isResettingRef.current &&
        !isUnloadingRef.current
      ) {
        try {
          const status = await soundRef.current.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            const newTime = status.positionMillis / 1000;
            setCurrentTime(newTime);

            if (
              status.durationMillis &&
              newTime >= status.durationMillis / 1000 - 0.05
            ) {
              if (
                !isResettingRef.current &&
                !isFinishedRef.current &&
                !isUnloadingRef.current
              ) {
                isFinishedRef.current = true;
                resetAudio();
              }
            }
          }
        } catch (error) {
          // Ignore
        }
      }
    }, 100);
  };

  const resetAudio = async () => {
    if (isResettingRef.current || isUnloadingRef.current) return;
    isResettingRef.current = true;

    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await soundRef.current.stopAsync().catch(() => {});
          }
          if (!isUnloadingRef.current) {
            await soundRef.current.setPositionAsync(0).catch(() => {});
          }
        }
      }

      setIsPlaying(false);
      setCurrentTime(0);
      stopWaveAnimation();
      AudioManager.clearCurrentSound(messageIdRef.current);

      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }

      setTimeout(() => {
        isFinishedRef.current = false;
      }, 100);
    } catch (error) {
      // Ignore
    } finally {
      isResettingRef.current = false;
    }
  };

  const togglePlayback = async () => {
    animateButtonPress();

    if (error) {
      await loadSound();
      return;
    }

    if (!soundRef.current) {
      await loadSound();
      return;
    }

    if (isUnloadingRef.current) return;

    isFinishedRef.current = false;

    if (isPlaying) {
      await pauseAudio();
    } else {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          if (
            status.durationMillis &&
            status.positionMillis >= status.durationMillis - 100
          ) {
            await soundRef.current.setPositionAsync(0).catch(() => {});
            setCurrentTime(0);
          }

          await AudioManager.playSound(
            soundRef.current,
            messageIdRef.current,
            onPlayed,
          );
          setIsPlaying(true);
          startProgressTracking();

          if (!isPlayed && onPlayed) {
            setIsPlayed(true);
          }
        }
      } catch (err) {
        await loadSound();
        if (soundRef.current && !isUnloadingRef.current) {
          try {
            await AudioManager.playSound(
              soundRef.current,
              messageIdRef.current,
              onPlayed,
            );
            setIsPlaying(true);
            startProgressTracking();
          } catch (playError) {
            // Ignore
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
        style={[styles.playButton, { transform: [{ scale: buttonScaleAnim }] }]}
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
