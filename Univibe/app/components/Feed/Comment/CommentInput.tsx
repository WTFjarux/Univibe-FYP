import React, { forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ReplyingToType {
  commentId: string;
  username: string;
  mentionUsername: string;
  isAnonymous: boolean;
}

interface CommentInputProps {
  /** Current input value */
  value: string;
  /** Callback when input text changes */
  onChangeText: (text: string) => void;
  /** Callback when submit button is pressed */
  onSubmit: () => void;
  /** Whether comment should be anonymous */
  isAnonymous: boolean;
  /** Toggle anonymous mode */
  onAnonymousToggle: () => void;
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Reply context - shows who user is replying to */
  replyingTo: ReplyingToType | null;
  /** Cancel reply mode */
  onCancelReply: () => void;
  /** Placeholder text when not replying */
  placeholder?: string;
}

/**
 * Comment input component with anonymous toggle and reply indicator
 * Features:
 * - Multiline text input with character limit
 * - Anonymous mode toggle with visual feedback
 * - Reply indicator when replying to a comment
 * - Submit button with loading state
 */
const CommentInput = forwardRef<TextInput, CommentInputProps>(
  (
    {
      value,
      onChangeText,
      onSubmit,
      isAnonymous,
      onAnonymousToggle,
      isSubmitting,
      replyingTo,
      onCancelReply,
      placeholder = "Write a comment...",
    },
    ref,
  ) => {
    const handleSubmit = () => {
      if (value.trim() && !isSubmitting) {
        onSubmit();
      }
    };

    return (
      <View style={styles.inputContainer}>
        {/* Reply Indicator - Shows when replying to a comment */}
        {replyingTo && (
          <View style={styles.replyingIndicator}>
            <Text style={styles.replyingText}>
              Replying to{" "}
              <Text style={styles.replyingUsername}>
                @{replyingTo.username}
              </Text>
            </Text>
            <TouchableOpacity
              onPress={onCancelReply}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* Main Input Row */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={ref}
            style={[
              styles.input,
              replyingTo && styles.inputWithReply,
              isAnonymous && styles.inputAnonymous,
            ]}
            placeholder={replyingTo ? "Write a reply..." : placeholder}
            placeholderTextColor="#9ca3af"
            value={value}
            onChangeText={onChangeText}
            multiline
            maxLength={500}
            editable={!isSubmitting}
            returnKeyType="default"
            blurOnSubmit={false}
            textAlignVertical="center"
          />

          {/* Anonymous Toggle Button */}
          <TouchableOpacity
            style={[
              styles.anonymousToggle,
              isAnonymous && styles.anonymousToggleActive,
            ]}
            onPress={onAnonymousToggle}
            disabled={isSubmitting}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isAnonymous ? "eye-off" : "eye-off-outline"}
              size={20}
              color={isAnonymous ? "#8b5cf6" : "#6b7280"}
            />
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!value.trim() || isSubmitting) && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!value.trim() || isSubmitting}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Character Count */}
        <View style={styles.footer}>
          <Text style={styles.charCount}>{value.length}/500</Text>
        </View>

        {/* Anonymous Status Message */}
        {isAnonymous && (
          <View style={styles.anonymousStatus}>
            <Ionicons name="eye-off-outline" size={12} color="#8b5cf6" />
            <Text style={styles.anonymousStatusText}>
              Your identity will be hidden
            </Text>
          </View>
        )}
      </View>
    );
  },
);

CommentInput.displayName = "CommentInput";

const styles = StyleSheet.create({
  /**
   * Main container with top border
   */
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === "ios" ? 12 : 12,
  },

  /**
   * Reply indicator bar showing who user is replying to
   */
  replyingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  replyingText: {
    fontSize: 13,
    color: "#6b7280",
    flex: 1,
  },
  replyingUsername: {
    color: "#8b5cf6",
    fontWeight: "600",
  },

  /**
   * Input row containing text input and buttons
   */
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 44,
    backgroundColor: "#f9fafb",
    color: "#111827",
    lineHeight: 20,
  },
  inputWithReply: {
    borderColor: "#8b5cf6",
    backgroundColor: "#faf5ff",
  },
  inputAnonymous: {
    borderColor: "#c4b5fd",
  },

  /**
   * Anonymous toggle button
   */
  anonymousToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  anonymousToggleActive: {
    backgroundColor: "#ede9fe",
    borderColor: "#8b5cf6",
  },

  /**
   * Submit button
   */
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
    backgroundColor: "#c4b5fd",
  },

  /**
   * Footer section
   */
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: "#9ca3af",
  },

  /**
   * Anonymous status message
   */
  anonymousStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#f5f3ff",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  anonymousStatusText: {
    fontSize: 11,
    color: "#8b5cf6",
  },
});

export default CommentInput;
