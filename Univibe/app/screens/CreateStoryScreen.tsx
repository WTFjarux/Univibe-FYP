import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode } from "expo-av";
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  FlashMode,
  CameraMode,
} from "expo-camera";
import { BlurView } from "expo-blur";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import storyApi from "../../lib/services/storyApi";

const { width, height } = Dimensions.get("window");

// Instagram-like constants (same as StoryMedia)
const STORY_ASPECT_RATIO = 9 / 16;
const MAX_STORY_WIDTH = width;
const MAX_STORY_HEIGHT = height * 0.95;

interface PickedMedia {
  uri: string;
  type: "image" | "video";
  name: string;
}

export default function CreateStoryScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const captionRef = useRef<TextInput>(null);
  const videoRef = useRef<Video>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraMode, setCameraMode] = useState<CameraMode>("picture");
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedMedia, setCapturedMedia] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(true);

  // Instagram-like fixed dimensions
  const storyDimensions = useMemo(() => {
    let storyWidth = MAX_STORY_WIDTH;
    let storyHeight = storyWidth / STORY_ASPECT_RATIO;

    if (storyHeight > MAX_STORY_HEIGHT) {
      storyHeight = MAX_STORY_HEIGHT;
      storyWidth = storyHeight * STORY_ASPECT_RATIO;
    }

    return {
      width: Math.floor(storyWidth),
      height: Math.floor(storyHeight),
    };
  }, []);

  // ================= KEYBOARD LISTENERS =================
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ================= PERMISSION =================
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // ================= RECORDING TIMER =================
  const startRecordingTimer = () => {
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ================= MEDIA LOAD HANDLERS =================
  const handlePreviewImageLoad = useCallback(() => {
    setIsPreviewLoading(false);
  }, []);

  const handlePreviewVideoLoad = useCallback((status: any) => {
    if (status.isLoaded) {
      setIsPreviewLoading(false);
    }
  }, []);

  // ================= CAMERA ACTIONS =================
  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const toggleFlash = () => {
    setFlash((current) => {
      if (current === "off") return "on";
      if (current === "on") return "auto";
      return "off";
    });
  };

  const getFlashIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (flash) {
      case "on":
        return "flash";
      case "auto":
        return "flash-outline";
      default:
        return "flash-off";
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      setCapturedMedia({
        uri: photo.uri,
        type: "image",
        name: `story-${Date.now()}.jpg`,
      });
      setIsPreviewLoading(true);
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const toggleRecording = async () => {
    if (!cameraRef.current) return;

    if (isRecording) {
      setIsRecording(false);
      stopRecordingTimer();
      try {
        cameraRef.current.stopRecording();
      } catch (error) {
        console.error("Error stopping video:", error);
      }
    } else {
      setIsRecording(true);
      startRecordingTimer();
      try {
        cameraRef.current
          .recordAsync({ maxDuration: 60 })
          .then((video) => {
            if (video) {
              setCapturedMedia({
                uri: video.uri,
                type: "video",
                name: `story-${Date.now()}.mp4`,
              });
              setIsPreviewLoading(true);
            }
            setIsRecording(false);
            stopRecordingTimer();
          })
          .catch((error) => {
            console.error("Recording error:", error);
            setIsRecording(false);
            stopRecordingTimer();
          });
      } catch (error) {
        console.error("Error recording video:", error);
        setIsRecording(false);
        stopRecordingTimer();
      }
    }
  };

  const handleCapture = () => {
    if (cameraMode === "picture") {
      takePhoto();
    } else {
      toggleRecording();
    }
  };

  // ================= GALLERY PICK =================
  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video" || asset.uri.endsWith(".mp4");
        setCapturedMedia({
          uri: asset.uri,
          type: isVideo ? "video" : "image",
          name:
            asset.fileName || `story-${Date.now()}.${isVideo ? "mp4" : "jpg"}`,
        });
        setIsPreviewLoading(true);
      }
    } catch (error) {
      console.error("Error picking from gallery:", error);
    }
  };

  // ================= UPLOAD =================
  const handleUpload = async () => {
    if (!capturedMedia) return;

    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const formData = new FormData();
      const mimeType =
        capturedMedia.type === "video" ? "video/mp4" : "image/jpeg";

      formData.append("media", {
        uri: capturedMedia.uri,
        type: mimeType,
        name: capturedMedia.name,
      } as any);

      if (caption.trim()) {
        formData.append("caption", caption.trim());
      }

      const res = await storyApi.createStory(formData);

      if (res.success) {
        Alert.alert("Success", "Your Moment has been posted!", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("Error", res.message || "Upload failed");
      }
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscard = () => {
    setCapturedMedia(null);
    setCaption("");
    setIsPreviewLoading(true);
  };

  // ================= PERMISSION DENIED =================
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Ionicons name="camera-outline" size={64} color="#8b5cf6" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          Allow camera access to create stories
        </Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={requestPermission}
        >
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        >
          <Text style={styles.cancelText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ================= IMAGE PREVIEW =================
  if (capturedMedia && capturedMedia.type === "image") {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.previewContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {/* Background Layer - Blurred effect */}
          <View style={styles.backgroundContainer}>
            <Image
              source={{ uri: capturedMedia.uri }}
              style={styles.backgroundMediaFull}
              resizeMode="cover"
              blurRadius={50}
            />
          </View>

          {/* Foreground Image - Instagram-like fixed dimensions */}
          <View style={styles.mediaContainer}>
            <View style={[styles.mediaWrapper, storyDimensions]}>
              <Image
                source={{ uri: capturedMedia.uri }}
                style={styles.mediaContent}
                resizeMode="cover"
                onLoad={handlePreviewImageLoad}
              />

              {/* Loading overlay */}
              {isPreviewLoading && (
                <View style={styles.previewLoader}>
                  <ActivityIndicator
                    size="large"
                    color="rgba(255,255,255,0.8)"
                  />
                </View>
              )}
            </View>
          </View>

          {/* Top Bar */}
          <View style={styles.previewTopBar}>
            <TouchableOpacity
              onPress={handleDiscard}
              style={styles.previewIconBtn}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
            <TouchableOpacity onPress={handleUpload} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#8b5cf6" size="small" />
              ) : (
                <Text style={styles.shareText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Right Side Tools - Hide when keyboard is visible */}
          {!isKeyboardVisible && (
            <View style={styles.previewRightTools}>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="happy-outline" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="musical-notes" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="color-wand-outline" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewRightToolBtn, styles.deleteBtn]}
                onPress={handleDiscard}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Caption Box - moves just above keyboard */}
          <View
            style={[
              styles.captionContainer,
              {
                bottom: isKeyboardVisible
                  ? keyboardHeight + 16
                  : Platform.OS === "ios"
                    ? 40
                    : 24,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => captionRef.current?.focus()}
            >
              <View style={styles.captionBox}>
                <TextInput
                  ref={captionRef}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={caption}
                  onChangeText={setCaption}
                  style={styles.previewCaptionInput}
                  multiline
                  maxLength={500}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // ================= VIDEO PREVIEW =================
  if (capturedMedia && capturedMedia.type === "video") {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.previewContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />

          {/* Background Layer - Blurred effect for video */}
          <View style={styles.backgroundContainer}>
            <Video
              source={{ uri: capturedMedia.uri }}
              style={styles.backgroundMediaFull}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isLooping={false}
              isMuted={true}
            />
            <BlurView
              intensity={80}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          {/* Foreground Video - Instagram-like fixed dimensions */}
          <View style={styles.mediaContainer}>
            <View style={[styles.mediaWrapper, storyDimensions]}>
              <Video
                ref={videoRef}
                source={{ uri: capturedMedia.uri }}
                style={styles.mediaContent}
                resizeMode={ResizeMode.COVER}
                shouldPlay={true}
                isLooping={true}
                isMuted={false}
                onLoad={handlePreviewVideoLoad}
              />

              {/* Loading overlay */}
              {isPreviewLoading && (
                <View style={styles.previewLoader}>
                  <ActivityIndicator
                    size="large"
                    color="rgba(255,255,255,0.8)"
                  />
                </View>
              )}
            </View>
          </View>

          {/* Top Bar */}
          <View style={styles.previewTopBar}>
            <TouchableOpacity
              onPress={handleDiscard}
              style={styles.previewIconBtn}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Preview</Text>
            <TouchableOpacity onPress={handleUpload} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#8b5cf6" size="small" />
              ) : (
                <Text style={styles.shareText}>Share</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Right Side Tools - Hide when keyboard is visible */}
          {!isKeyboardVisible && (
            <View style={styles.previewRightTools}>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="happy-outline" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="musical-notes" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.previewRightToolBtn}>
                <Ionicons name="color-wand-outline" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewRightToolBtn, styles.deleteBtn]}
                onPress={handleDiscard}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Caption Box - moves just above keyboard for video */}
          <View
            style={[
              styles.captionContainer,
              {
                bottom: isKeyboardVisible
                  ? keyboardHeight + 16
                  : Platform.OS === "ios"
                    ? 40
                    : 24,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => captionRef.current?.focus()}
            >
              <View style={styles.captionBox}>
                <TextInput
                  ref={captionRef}
                  placeholder="Add a caption..."
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  value={caption}
                  onChangeText={setCaption}
                  style={styles.previewCaptionInput}
                  multiline
                  maxLength={500}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // ================= CAMERA UI =================
  return (
    <View style={styles.cameraContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Camera View */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode={cameraMode}
      />

      {/* Top Bar */}
      <View style={styles.cameraTopBar}>
        <TouchableOpacity
          style={styles.cameraTopBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>

        {/* Timer Display */}
        {isRecording && (
          <View style={styles.timerContainer}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
          </View>
        )}

        <View style={styles.cameraTopRight}>
          {!isRecording && (
            <>
              <TouchableOpacity
                style={styles.cameraTopBtn}
                onPress={toggleFlash}
              >
                <Ionicons
                  name={getFlashIcon()}
                  size={22}
                  color={flash !== "off" ? "#fbbf24" : "white"}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.cameraTopBtn}>
                <Ionicons name="settings-outline" size={22} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Bottom Controls */}
      <View style={styles.cameraBottomBar}>
        {/* Gallery Preview */}
        {!isRecording && (
          <TouchableOpacity
            style={styles.galleryPreview}
            onPress={pickFromGallery}
          >
            <Ionicons name="images-outline" size={28} color="white" />
          </TouchableOpacity>
        )}

        {/* Capture Section */}
        <View style={styles.captureSection}>
          {/* Mode Switcher */}
          {!isRecording && (
            <View style={styles.modeSwitcher}>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  cameraMode === "picture" && styles.modeOptionActive,
                ]}
                onPress={() => setCameraMode("picture")}
              >
                <Text
                  style={[
                    styles.modeOptionText,
                    cameraMode === "picture" && styles.modeOptionTextActive,
                  ]}
                >
                  PHOTO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeOption,
                  cameraMode === "video" && styles.modeOptionActive,
                ]}
                onPress={() => setCameraMode("video")}
              >
                <Text
                  style={[
                    styles.modeOptionText,
                    cameraMode === "video" && styles.modeOptionTextActive,
                  ]}
                >
                  VIDEO
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Capture Button */}
          <TouchableOpacity
            style={[
              styles.captureBtn,
              cameraMode === "video" && styles.captureBtnVideo,
              isRecording && styles.captureBtnRecording,
            ]}
            onPress={handleCapture}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.captureBtnInner,
                cameraMode === "video" && styles.captureBtnInnerVideo,
                isRecording && styles.captureBtnInnerRecording,
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* Flip Camera */}
        {!isRecording && (
          <TouchableOpacity
            style={styles.flipCameraBtn}
            onPress={toggleCameraFacing}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ================= STYLES =================

const styles = StyleSheet.create({
  // Permission
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  permissionTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 20,
  },
  permissionText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  permissionBtn: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  permissionBtnText: { color: "white", fontSize: 16, fontWeight: "600" },
  cancelText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },

  // Camera
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  camera: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // Top Bar
  cameraTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  cameraTopRight: { flexDirection: "row", gap: 12 },
  cameraTopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Timer
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
  },
  timerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },

  // Bottom Bar
  cameraBottomBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 24,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  galleryPreview: {
    position: "absolute",
    left: 0,
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  captureSection: { alignItems: "center", gap: 16 },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 3,
  },
  modeOption: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 17 },
  modeOptionActive: { backgroundColor: "white" },
  modeOptionText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  modeOptionTextActive: { color: "#000" },

  // Capture Button - PHOTO mode (white ring)
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  captureBtnInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "white",
  },

  // Capture Button - VIDEO mode (red circle)
  captureBtnVideo: {
    borderColor: "white",
    borderWidth: 5,
  },
  captureBtnInnerVideo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#ef4444",
  },

  // Capture Button - RECORDING state
  captureBtnRecording: {
    borderColor: "#ef4444",
    borderWidth: 6,
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  captureBtnInnerRecording: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: "#ef4444",
  },

  flipCameraBtn: {
    position: "absolute",
    right: 0,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ===== PREVIEW STYLES =====
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Background blur layer
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundMediaFull: {
    width: "100%",
    height: "100%",
  },

  // Media container for centering - Same as StoryMedia
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Fixed Instagram-like wrapper - Same as StoryMedia
  mediaWrapper: {
    borderRadius: 12,
    overflow: "hidden",

    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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

  // Media content fills wrapper completely - Same as StoryMedia
  mediaContent: {
    width: "100%",
    height: "100%",
  },

  // Preview loader overlay
  previewLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  previewTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 44,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  previewIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewTitle: { color: "white", fontSize: 18, fontFamily: "SofiaSans-Bold" },
  shareText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 42,
    elevation: 3,
  },

  // Right Side Tools for Preview
  previewRightTools: {
    position: "absolute",
    right: 16,
    top: "35%",
    gap: 16,
    zIndex: 10,
  },
  previewRightToolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  deleteBtn: {
    marginTop: 8,
    borderColor: "#ef4444",
  },

  // Unified Caption Container - moves with keyboard
  captionContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  captionBox: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },

  previewCaptionInput: {
    color: "white",
    fontSize: 16,
    minHeight: 44,
    maxHeight: 100,
    textAlignVertical: "center",
  },
});
