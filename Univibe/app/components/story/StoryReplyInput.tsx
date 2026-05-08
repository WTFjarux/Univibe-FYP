import React, { memo, useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
} from "react-native";
import storyApi from "../../../lib/services/storyApi";
import type { Story } from "../../../lib/services/storyApi"; // ✅ Add this import

interface StoryReplyInputProps {
  storyId: string;
  story?: Story; // ✅ Now Story type is recognized
  visible: boolean;
  onFocusChange?: (focused: boolean) => void;
}

const StoryReplyInput = memo(
  ({ storyId, story, visible, onFocusChange }: StoryReplyInputProps) => {
    // ✅ Destructure story
    const [replyText, setReplyText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Reset when visibility changes
    useEffect(() => {
      if (!visible) {
        setReplyText("");
        setIsFocused(false);

        // Notify parent that focus is lost
        if (onFocusChange && isFocused) {
          onFocusChange(false);
        }
      }
    }, [visible]);

    // Notify parent when focus changes
    useEffect(() => {
      if (onFocusChange) {
        onFocusChange(isFocused);
      }
    }, [isFocused]);

    const handleSendReply = async () => {
      if (!replyText.trim() || isSending) return;

      setIsSending(true);
      try {
        // ✅ Log what we're sending
        console.log("📤 Sending reply with story data:", {
          storyId,
          storyData: {
            storyId: storyId,
            mediaUrl: story?.mediaUrl,
            thumbnailUrl: story?.mediaUrl,
            caption: story?.caption,
            type: story?.type,
          },
        });

        await storyApi.replyToStory(storyId, replyText.trim(), {
          storyId: storyId,
          mediaUrl: story?.mediaUrl,
          thumbnailUrl: story?.mediaUrl,
          caption: story?.caption,
          type: story?.type,
        });

        setReplyText("");
        setIsFocused(false);
        inputRef.current?.blur();
        Alert.alert("Sent", "Your reply has been sent");
      } catch (error) {
        console.error("Error sending reply:", error);
        Alert.alert("Error", "Failed to send reply. Please try again.");
      } finally {
        setIsSending(false);
      }
    };

    const handleInputPress = () => {
      inputRef.current?.focus();
    };

    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setTimeout(() => {
        setIsFocused(false);
      }, 200);
    };

    const handleDismissKeyboard = () => {
      inputRef.current?.blur();
      setIsFocused(false);
    };

    if (!visible) return null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        style={styles.keyboardView}
      >
        {isFocused && (
          <TouchableOpacity
            style={styles.dismissOverlay}
            activeOpacity={1}
            onPress={handleDismissKeyboard}
          />
        )}

        <View style={styles.container}>
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.inputContainer}
              onPress={handleInputPress}
              activeOpacity={1}
            >
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Send message..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                maxLength={500}
                multiline
                textAlignVertical="center"
                returnKeyType="send"
                onSubmitEditing={handleSendReply}
                editable={true}
              />
            </TouchableOpacity>

            {(replyText.trim().length > 0 || isFocused) && (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !replyText.trim() && styles.sendButtonDisabled,
                ]}
                onPress={handleSendReply}
                disabled={!replyText.trim() || isSending}
                activeOpacity={0.7}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  keyboardView: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  dismissOverlay: {
    position: "absolute",
    top: -600,
    left: 0,
    right: 0,
    height: 600,
    zIndex: 15,
  },
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === "ios" ? 18 : 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 15,
    zIndex: 20,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    overflow: "hidden",
    minHeight: 44,
    maxHeight: 120,
  },
  input: {
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: "#fff",
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 20,
  },
  sendButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-Regular",
  },
});

export default StoryReplyInput;
