// app/components/chat/ChatInput.tsx (UPDATED - added ref support)
import React, {
  useState,
  useRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  (
    {
      onSendMessage,
      onStartRecording,
      onStopRecording,
      onCancelRecording,
      isRecording,
      recordingDuration,
      uploading,
      socketConnected,
    },
    ref,
  ) => {
    const [inputText, setInputText] = useState("");
    const [showRecordingUI, setShowRecordingUI] = useState(false);
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      blur: () => {
        inputRef.current?.blur();
      },
      clear: () => {
        setInputText("");
      },
    }));

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim = useRef(new Animated.Value(0)).current;

    // Minimum recording duration in seconds
    const MIN_RECORDING_DURATION = 1;

    // Format duration as mm:ss
    const formatDuration = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Start pulse animation for recording dot
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

        // Wave animation for waveform
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

    // Handle recording UI transition
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

    // Handle send text message
    const handleSend = () => {
      if (!inputText.trim()) return;
      onSendMessage(inputText);
      setInputText("");
    };

    // Handle start recording with haptic feedback
    const handleStartRecording = async () => {
      if (uploading) return;

      // Provide haptic feedback
      if (Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      await onStartRecording();
    };

    // Handle cancel recording - discards the recording
    const handleCancelRecording = async () => {
      if (uploading) return;

      // Provide haptic feedback
      if (Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Use dedicated cancel function if provided, otherwise call stop with false
      if (onCancelRecording) {
        await onCancelRecording();
      } else {
        await onStopRecording(false); // false = don't send
      }
      setShowRecordingUI(false);
    };

    // Handle send recording - saves and sends the recording
    const handleSendRecording = async () => {
      if (uploading) return;

      // Check minimum duration
      if (recordingDuration < MIN_RECORDING_DURATION) {
        Alert.alert(
          "Recording Too Short",
          `Please record at least ${MIN_RECORDING_DURATION} second.`,
          [{ text: "OK", onPress: () => handleCancelRecording() }],
        );
        return;
      }

      // Provide haptic feedback
      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Stop recording and send (true = send)
      await onStopRecording(true);
      setShowRecordingUI(false);
    };

    // Normal input UI (when not recording)
    const renderNormalUI = () => (
      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message..."
              placeholderTextColor="#999"
              multiline
              editable={!uploading}
            />
          </View>

          <TouchableOpacity
            style={[styles.voiceButton, uploading && styles.disabledButton]}
            onPress={handleStartRecording}
            disabled={uploading || !socketConnected}
            activeOpacity={0.7}
          >
            <Ionicons name="mic-outline" size={24} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !socketConnected || uploading) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || !socketConnected || uploading}
            activeOpacity={0.7}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="arrow-up" size={22} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );

    // Recording UI (Instagram DM style)
    const renderRecordingUI = () => (
      <Animated.View
        style={[
          styles.recordingArea,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.recordingContainer}>
          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRecording}
            disabled={uploading}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color="#8E8E93" />
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          {/* Recording Indicator and Timer */}
          <View style={styles.recordingIndicator}>
            <Animated.View
              style={[
                styles.recordingDot,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <Text style={styles.recordingTimer}>
              {formatDuration(recordingDuration)}
            </Text>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendRecordingButton,
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

        {/* Waveform Visualization (Bonus) */}
        <View style={styles.waveformContainer}>
          {[...Array(20)].map((_, i) => {
            // Create animated height for each bar
            const animatedHeight = waveAnim.interpolate({
              inputRange: [0, 0.3, 0.6, 1],
              outputRange: [4, 15 + Math.sin(i) * 10, 25 + Math.cos(i) * 8, 4],
            });

            return (
              <Animated.View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: animatedHeight,
                    opacity: isRecording ? 0.8 : 0.3,
                  },
                ]}
              />
            );
          })}
        </View>
      </Animated.View>
    );

    return <>{showRecordingUI ? renderRecordingUI() : renderNormalUI()}</>;
  },
);

ChatInput.displayName = "ChatInput";

const styles = StyleSheet.create({
  // Normal Input Styles
  inputArea: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    paddingTop: 5,
    borderTopColor: "#e5e5ea",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 25,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e5e5ea",
  },
  input: {
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: "#000",
    fontFamily: "SofiaSans-Regular",
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  disabledButton: {
    opacity: 0.5,
  },

  // Recording UI Styles (Instagram DM Style)
  recordingArea: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    paddingBottom: 12,
  },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  cancelText: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f8f9fa",
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
    backgroundColor: "#8b5cf6",
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

  // Waveform Visualization
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 16,
    paddingBottom: 8,
    height: 40,
  },
  waveformBar: {
    width: 3,
    backgroundColor: "#007AFF",
    borderRadius: 1.5,
  },
});

export default ChatInput;
