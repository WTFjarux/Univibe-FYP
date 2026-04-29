// app/components/chat/ChatMessage/ChatVideoPlayer.tsx

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Text,
  PanResponder,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useEventListener } from "expo";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const VIDEO_HEIGHT = SCREEN_HEIGHT * 0.7;

interface ChatVideoPlayerProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export default function ChatVideoPlayer({
  visible,
  uri,
  onClose,
}: ChatVideoPlayerProps) {
  const sliderContainerRef = useRef<View>(null);
  const sliderWidth = useRef(0);

  const [isSliding, setIsSliding] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [position, setPosition] = useState(0);

  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.muted = false;
    player.timeUpdateEventInterval = 0.25;
  });

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  // Listen to timeUpdate and store position manually
  useEventListener(player, "timeUpdate", (payload) => {
    setPosition(payload.currentTime);
  });

  const isBuffering = status === "loading";
  const duration = player.duration;

  const updateSliderFromEvent = useCallback((evt: any) => {
    if (sliderWidth.current <= 0) return;
    sliderContainerRef.current?.measure((_fx, _fy, _width, _height, px) => {
      const relativeX = evt.nativeEvent.pageX - px;
      const percent = Math.max(0, Math.min(relativeX / sliderWidth.current, 1));
      setSliderValue(percent);
    });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSliding(true);
        updateSliderFromEvent(evt);
      },
      onPanResponderMove: (evt) => {
        updateSliderFromEvent(evt);
      },
      onPanResponderRelease: () => {
        if (duration > 0) {
          const newPosition = sliderValue * duration;
          player.currentTime = newPosition;
          player.play();
        }
        setIsSliding(false);
      },
    }),
  ).current;

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, player]);

  const displayProgress = isSliding
    ? sliderValue
    : duration > 0
      ? position / duration
      : 0;

  const displayTime =
    duration > 0 ? (isSliding ? sliderValue * duration : position) : 0;

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClose = useCallback(() => {
    player.pause();
    onClose();
  }, [player, onClose]);

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" translucent />
      <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />

      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.videoContainer}>
        <TouchableOpacity
          style={styles.videoTouchArea}
          activeOpacity={1}
          onPress={togglePlayPause}
        >
          <View style={styles.videoWrapper}>
            <VideoView
              player={player}
              style={styles.video}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
        </TouchableOpacity>

        {!isPlaying && !isBuffering && (
          <View style={styles.centerIcon} pointerEvents="none">
            <Ionicons
              name="play-circle"
              size={64}
              color="rgba(255,255,255,0.8)"
            />
          </View>
        )}

        {isBuffering && (
          <View style={styles.centerIcon} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.bottomControls}>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            onPress={togglePlayPause}
            style={styles.playPauseBtn}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          <View
            ref={sliderContainerRef}
            style={styles.sliderContainer}
            onLayout={(e) => {
              sliderWidth.current = e.nativeEvent.layout.width;
            }}
            {...panResponder.panHandlers}
          >
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  { width: `${displayProgress * 100}%` },
                ]}
              />
            </View>
            <View
              style={[
                styles.sliderThumb,
                { left: displayProgress * sliderWidth.current },
              ]}
            />
          </View>
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(displayTime)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  videoContainer: {
    position: "absolute",
    top: (SCREEN_HEIGHT - VIDEO_HEIGHT) / 2,
    left: 0,
    right: 0,
    height: VIDEO_HEIGHT,
  },
  videoTouchArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  videoWrapper: {
    width: SCREEN_WIDTH * 0.95,
    height: VIDEO_HEIGHT,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },
  centerIcon: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomControls: {
    position: "absolute",
    bottom: (SCREEN_HEIGHT - VIDEO_HEIGHT) / 2,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  controlsRow: { flexDirection: "row", alignItems: "center" },
  playPauseBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sliderContainer: { flex: 1, height: 40, justifyContent: "center" },
  sliderTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
  },
  sliderFill: { height: "100%", backgroundColor: "#fff" },
  sliderThumb: {
    position: "absolute",
    top: 11,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    marginLeft: -8,
  },
  timeRow: { flexDirection: "row", marginTop: 4, paddingLeft: 50 },
  timeText: { color: "#fff", fontSize: 12, fontFamily: "SofiaSans-Regular" },
});
