// app/components/chat/ChatMessage/ChatInput.tsx

import React, {
  useState,
  useRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useCallback,
} from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
  Animated,
  Dimensions,
  Alert,
  Platform,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { API_BASE_URL } from "../../../../constants/ipConstants";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface ChatInputRef {
  focus: () => void;
  blur: () => void;
  clear: () => void;
}

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: (shouldSend?: boolean) => Promise<void>;
  onCancelRecording?: () => Promise<void>;
  isRecording: boolean;
  recordingDuration: number;
  uploading: boolean;
  socketConnected: boolean;
  onAttachmentsSelected?: (attachments: AttachmentData[]) => void;
  onLocationShared?: (location: AttachmentData) => void;
  token?: string;
  roomId?: string;
}

export interface AttachmentData {
  type: "image" | "video" | "document" | "location";
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>((props, ref) => {
  const {
    onSendMessage,
    onStartRecording,
    onStopRecording,
    onCancelRecording,
    isRecording,
    recordingDuration,
    uploading,
    socketConnected,
    onAttachmentsSelected,
    onLocationShared,
    token,
    roomId,
  } = props;

  const [inputText, setInputText] = useState("");
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { colors } = useTheme();

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
    clear: () => setInputText(""),
  }));

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const attachSheetAnim = useRef(new Animated.Value(0)).current;

  const MIN_RECORDING_DURATION = 1;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (showRecordingUI && isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
          }),
          Animated.timing(waveAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [showRecordingUI, isRecording]);

  useEffect(() => {
    if (isRecording) {
      setShowRecordingUI(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!isRecording && showRecordingUI) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 0.95,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowRecordingUI(false);
        scaleAnim.setValue(1);
      });
    }
  }, [isRecording]);

  const openAttachmentSheet = useCallback(() => {
    setShowAttachmentSheet(true);
    Animated.spring(attachSheetAnim, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start();
  }, [attachSheetAnim]);

  const closeAttachmentSheet = useCallback(() => {
    Animated.timing(attachSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowAttachmentSheet(false));
  }, [attachSheetAnim]);

  const toggleAttachmentSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showAttachmentSheet ? closeAttachmentSheet() : openAttachmentSheet();
  }, [showAttachmentSheet, openAttachmentSheet, closeAttachmentSheet]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  const pickImages = async () => {
    closeAttachmentSheet();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      const attachments: AttachmentData[] = result.assets.map((asset) => ({
        type: "image" as const,
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType || "image/jpeg",
      }));
      onAttachmentsSelected?.(attachments);
    }
  };

  const takePhoto = async () => {
    closeAttachmentSheet();
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAttachmentsSelected?.([
        {
          type: "image",
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          size: asset.fileSize || 0,
          mimeType: asset.mimeType || "image/jpeg",
        },
      ]);
    }
  };

  const pickVideo = async () => {
    closeAttachmentSheet();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      videoMaxDuration: 60,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onAttachmentsSelected?.([
        {
          type: "video",
          uri: asset.uri,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          size: asset.fileSize || 0,
          mimeType: asset.mimeType || "video/mp4",
        },
      ]);
    }
  };

  const pickDocuments = async () => {
    closeAttachmentSheet();
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const attachments: AttachmentData[] = result.assets.map((asset) => ({
        type: "document" as const,
        uri: asset.uri,
        name: asset.name || `file_${Date.now()}`,
        size: asset.size || 0,
        mimeType: asset.mimeType || "application/octet-stream",
      }));
      onAttachmentsSelected?.(attachments);
    }
  };

  const shareLocation = async () => {
    closeAttachmentSheet();
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Location permission is required");
      return;
    }
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      onLocationShared?.({
        type: "location",
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        locationName: `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to get location");
    }
  };

  const handleStartRecording = async () => {
    if (uploading) return;
    if (Platform.OS === "ios")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await onStartRecording();
  };

  const handleCancelRecording = async () => {
    if (uploading) return;
    if (Platform.OS === "ios")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onCancelRecording) await onCancelRecording();
    else await onStopRecording(false);
    setShowRecordingUI(false);
  };

  const handleSendRecording = async () => {
    if (uploading) return;
    if (recordingDuration < MIN_RECORDING_DURATION) {
      Alert.alert(
        "Recording Too Short",
        `Please record at least ${MIN_RECORDING_DURATION} second.`,
        [{ text: "OK", onPress: () => handleCancelRecording() }],
      );
      return;
    }
    if (Platform.OS === "ios")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onStopRecording(true);
    setShowRecordingUI(false);
  };

  const attachmentOptions = [
    {
      icon: "images-outline",
      label: "Gallery",
      color: "#007AFF",
      onPress: pickImages,
    },
    {
      icon: "camera-outline",
      label: "Camera",
      color: "#34C759",
      onPress: takePhoto,
    },
    {
      icon: "videocam-outline",
      label: "Video",
      color: "#FF9500",
      onPress: pickVideo,
    },
    {
      icon: "document-outline",
      label: "Files",
      color: "#5856D6",
      onPress: pickDocuments,
    },
    {
      icon: "location-outline",
      label: "Location",
      color: "#FF3B30",
      onPress: shareLocation,
    },
  ];

  return (
    <View>
      {showAttachmentSheet && (
        <Pressable style={styles.backdrop} onPress={closeAttachmentSheet} />
      )}

      {showAttachmentSheet && (
        <Animated.View
          style={[
            styles.attachmentSheet,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              transform: [
                {
                  translateY: attachSheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [150, 0],
                  }),
                },
              ],
              opacity: attachSheetAnim,
            },
          ]}
        >
          <View style={styles.attachmentSheetContent}>
            {attachmentOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.attachmentOption}
                onPress={option.onPress}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.attachmentIcon,
                    { backgroundColor: `${option.color}15` },
                  ]}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={option.color}
                  />
                </View>
                <Text
                  style={[
                    styles.attachmentLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {showRecordingUI ? (
        <Animated.View
          style={[
            styles.recordingArea,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.recordingContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelRecording}
              disabled={uploading}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color={colors.textSecondary} />
              <Text
                style={[styles.cancelText, { color: colors.textSecondary }]}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <View
              style={[
                styles.recordingIndicator,
                { backgroundColor: colors.background },
              ]}
            >
              <Animated.View
                style={[
                  styles.recordingDot,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <Text style={styles.recordingTimer}>
                {formatDuration(recordingDuration)}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.sendRecordingButton,
                { backgroundColor: colors.primary },
                uploading && styles.disabledButton,
              ]}
              onPress={handleSendRecording}
              disabled={uploading}
              activeOpacity={0.7}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="arrow-up" size={24} color="#fff" />
                  <Text style={styles.sendText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.waveformContainer}>
            {[...Array(20)].map((_, i) => {
              const h = waveAnim.interpolate({
                inputRange: [0, 0.3, 0.6, 1],
                outputRange: [
                  4,
                  15 + Math.sin(i) * 10,
                  25 + Math.cos(i) * 8,
                  4,
                ],
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveformBar,
                    { height: h, opacity: isRecording ? 0.8 : 0.3 },
                  ]}
                />
              );
            })}
          </View>
        </Animated.View>
      ) : (
        <View
          style={[
            styles.inputArea,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[
                styles.attachButton,
                { backgroundColor: colors.skeleton },
              ]}
              onPress={toggleAttachmentSheet}
              activeOpacity={0.7}
            >
              <Ionicons
                name={showAttachmentSheet ? "close" : "add"}
                size={24}
                color={showAttachmentSheet ? "#FF3B30" : colors.primary}
              />
            </TouchableOpacity>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.text }]}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message..."
                placeholderTextColor={colors.textMuted}
                multiline
                editable={!uploading}
              />
            </View>
            {inputText.trim() ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: colors.primary },
                  (!socketConnected || uploading) && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!socketConnected || uploading}
                activeOpacity={0.7}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-up" size={22} color="#fff" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  { backgroundColor: colors.skeleton },
                  uploading && styles.disabledButton,
                ]}
                onPress={handleStartRecording}
                disabled={uploading || !socketConnected}
                activeOpacity={0.7}
              >
                <Ionicons name="mic-outline" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
});

ChatInput.displayName = "ChatInput";

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: -SCREEN_HEIGHT,
    left: -SCREEN_WIDTH,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 3,
    height: SCREEN_HEIGHT * 3,
    zIndex: 5,
  },
  inputArea: { borderTopWidth: 1, paddingTop: 5 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 25,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  inputWrapper: { flex: 1, borderRadius: 24, borderWidth: 1 },
  input: {
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { backgroundColor: "#ccc" },
  disabledButton: { opacity: 0.5 },
  attachmentSheet: { borderTopWidth: 1, paddingVertical: 16, zIndex: 10 },
  attachmentSheetContent: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  attachmentOption: { alignItems: "center", gap: 8 },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentLabel: { fontSize: 11, fontFamily: "SofiaSans-Regular" },
  recordingArea: { borderTopWidth: 1, paddingBottom: 12 },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  cancelButton: { alignItems: "center", justifyContent: "center", padding: 8 },
  cancelText: { fontSize: 12, marginTop: 4, fontFamily: "SofiaSans-Regular" },
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
  },
  recordingTimer: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF3B30",
    fontFamily: "SofiaSans-Bold",
    letterSpacing: 1,
  },
  sendRecordingButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
  },
  sendText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    fontFamily: "SofiaSans-Bold",
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 16,
    paddingBottom: 8,
    height: 40,
  },
  waveformBar: { width: 3, backgroundColor: "#007AFF", borderRadius: 1.5 },
});

export default ChatInput;
