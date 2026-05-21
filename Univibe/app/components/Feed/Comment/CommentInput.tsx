import React, { forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/contexts/ThemeContext";

interface ReplyingToType {
  commentId: string;
  username: string;
  mentionUsername: string;
  isAnonymous: boolean;
}

interface CommentInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  isAnonymous: boolean;
  onAnonymousToggle: () => void;
  isSubmitting: boolean;
  replyingTo: ReplyingToType | null;
  onCancelReply: () => void;
  placeholder?: string;
}

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
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const handleSubmit = () => {
      if (value.trim() && !isSubmitting) {
        onSubmit();
      }
    };

    const dynamicStyles = {
      container: {
        borderTopColor: colors.border,
        backgroundColor: colors.card,
        paddingTop: 10,
        // Extends down to screen bounds using exact safe-area parameters
        paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
      },
      replyingIndicator: {
        backgroundColor: isDark ? colors.background : "#f9fafb",
      },
      replyingText: {
        color: colors.textSecondary,
      },
      replyingUsername: {
        color: colors.primary,
      },
      input: [
        styles.input,
        {
          borderColor: colors.border,
          backgroundColor: isDark ? colors.background : "#f9fafb",
          color: colors.text,
        },
        replyingTo && {
          borderColor: colors.primary,
          backgroundColor: colors.primaryLight,
        },
        isAnonymous && {
          borderColor: isDark ? colors.primary : "#c4b5fd",
        },
      ],
      anonymousToggle: [
        styles.anonymousToggle,
        {
          backgroundColor: isDark ? colors.background : "#f3f4f6",
          borderColor: colors.border,
        },
        isAnonymous && {
          backgroundColor: colors.primaryLight,
          borderColor: colors.primary,
        },
      ],
      sendButton: [
        styles.sendButton,
        { backgroundColor: colors.primary },
        (!value.trim() || isSubmitting) && {
          opacity: 0.5,
          backgroundColor: isDark ? colors.border : "#c4b5fd",
        },
      ],
      charCount: {
        color: colors.textMuted,
      },
      anonymousStatus: {
        backgroundColor: colors.primaryLight,
      },
      anonymousStatusText: {
        color: colors.primary,
      },
    };

    return (
      <View style={[styles.inputContainer, dynamicStyles.container]}>
        {/* Reply Indicator */}
        {replyingTo && (
          <View
            style={[styles.replyingIndicator, dynamicStyles.replyingIndicator]}
          >
            <Text style={[styles.replyingText, dynamicStyles.replyingText]}>
              Replying to{" "}
              <Text
                style={[
                  styles.replyingUsername,
                  dynamicStyles.replyingUsername,
                ]}
              >
                @{replyingTo.username}
              </Text>
            </Text>
            <TouchableOpacity
              onPress={onCancelReply}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Main Input Row */}
        <View style={styles.inputWrapper}>
          <TextInput
            ref={ref}
            style={dynamicStyles.input}
            placeholder={replyingTo ? "Write a reply..." : placeholder}
            placeholderTextColor={colors.textMuted}
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
            style={dynamicStyles.anonymousToggle}
            onPress={onAnonymousToggle}
            disabled={isSubmitting}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isAnonymous ? "eye-off" : "eye-off-outline"}
              size={20}
              color={isAnonymous ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={dynamicStyles.sendButton}
            onPress={handleSubmit}
            disabled={!value.trim() || isSubmitting}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.badgeText} />
            ) : (
              <Ionicons name="send" size={20} color={colors.badgeText} />
            )}
          </TouchableOpacity>
        </View>

        {/* Inline Compact Footer row */}
        <View style={styles.footerRow}>
          {isAnonymous ? (
            <View
              style={[styles.anonymousStatus, dynamicStyles.anonymousStatus]}
            >
              <Ionicons
                name="eye-off-outline"
                size={12}
                color={colors.primary}
              />
              <Text
                style={[
                  styles.anonymousStatusText,
                  dynamicStyles.anonymousStatusText,
                ]}
              >
                Your identity will be hidden
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={[styles.charCount, dynamicStyles.charCount]}>
            {value.length}/500
          </Text>
        </View>
      </View>
    );
  },
);

CommentInput.displayName = "CommentInput";

const styles = StyleSheet.create({
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
  },
  replyingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 12,
  },
  replyingText: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    flex: 1,
  },
  replyingUsername: {
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    maxHeight: 100,
    minHeight: 40,
    lineHeight: 20,
  },
  anonymousToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
    marginLeft: "auto",
  },
  anonymousStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  anonymousStatusText: {
    fontSize: 11,
    fontFamily: "SofiaSans-Regular",
  },
});

export default CommentInput;
