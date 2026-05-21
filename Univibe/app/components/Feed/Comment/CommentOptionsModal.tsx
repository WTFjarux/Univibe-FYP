// app/components/CommentOptionsModal.tsx

import React, { useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/contexts/ThemeContext";

interface CommentOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  commentId: string;
  postId: string;
  isOwnComment: boolean;
  isPostOwner: boolean;
  isReported?: boolean;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onShare?: (commentId: string) => void;
  onHide?: (commentId: string) => void;
  onShowInfoBar?: (message: string, type: "success" | "error" | "info") => void;
}

/**
 * CommentOptionsModal - Pure Presentational Component with Transparent Overlay
 */
const CommentOptionsModal: React.FC<CommentOptionsModalProps> = ({
  visible,
  onClose,
  commentId,
  isOwnComment,
  isPostOwner,
  isReported = false,
  onEdit,
  onDelete,
  onReport,
  onReply,
  onShare,
  onHide,
  onShowInfoBar,
}) => {
  const { colors } = useTheme();

  // ===== Dynamic Style Matrix =====
  const dynamicStyles = useMemo(
    () => ({
      modalContent: {
        backgroundColor: colors.card,
        // Added a subtle shadow so the sheet stands out cleanly against the transparent background
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.1,
            shadowRadius: 5,
          },
          android: {
            elevation: 10,
          },
        }),
      },
      optionText: {
        color: colors.text,
      },
      divider: {
        backgroundColor: colors.border,
      },
      cancelButton: {
        borderTopColor: colors.border,
      },
      cancelButtonText: {
        color: colors.textSecondary,
      },
    }),
    [colors],
  );

  const handleReply = () => {
    onClose();
    requestAnimationFrame(() => {
      if (onReply) onReply(commentId);
    });
  };

  const handleEdit = () => {
    onClose();
    requestAnimationFrame(() => {
      if (onEdit) onEdit(commentId);
    });
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onClose();
            requestAnimationFrame(() => {
              if (onDelete) onDelete(commentId);
            });
          },
        },
      ],
    );
  };

  const handleShare = () => {
    onClose();
    requestAnimationFrame(() => {
      if (onShare) onShare(commentId);
    });
  };

  const handleHide = () => {
    Alert.alert("Hide Comment", "Are you sure you want to hide this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        style: "destructive",
        onPress: () => {
          onClose();
          requestAnimationFrame(() => {
            if (onHide) onHide(commentId);
          });
        },
      },
    ]);
  };

  const handleReport = () => {
    if (isReported) {
      if (onShowInfoBar) {
        onShowInfoBar("You have already reported this comment", "info");
      }
      onClose();
      return;
    }

    onClose();
    requestAnimationFrame(() => {
      if (onReport) onReport(commentId);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalContent, dynamicStyles.modalContent]}>
          {/* Reply */}
          <TouchableOpacity style={styles.optionItem} onPress={handleReply}>
            <Ionicons name="chatbubble-outline" size={24} color={colors.icon} />
            <Text style={[styles.optionText, dynamicStyles.optionText]}>
              Reply
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={colors.icon} />
            <Text style={[styles.optionText, dynamicStyles.optionText]}>
              Share
            </Text>
          </TouchableOpacity>

          {/* Comment Owner Specific Options */}
          {isOwnComment ? (
            <>
              <View style={[styles.divider, dynamicStyles.divider]} />

              <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={24} color={colors.icon} />
                <Text style={[styles.optionText, dynamicStyles.optionText]}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                <Text style={[styles.optionText, styles.deleteText]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </>
          ) : isPostOwner ? (
            // Post Owner Options (for others' comments)
            <>
              <View style={[styles.divider, dynamicStyles.divider]} />

              <TouchableOpacity style={styles.optionItem} onPress={handleHide}>
                <Ionicons
                  name="eye-off-outline"
                  size={24}
                  color={colors.icon}
                />
                <Text style={[styles.optionText, dynamicStyles.optionText]}>
                  Hide
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                <Text style={[styles.optionText, styles.deleteText]}>
                  Delete
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleReport}
              >
                <Ionicons
                  name={isReported ? "flag" : "flag-outline"}
                  size={24}
                  color={isReported ? "#ef4444" : colors.icon}
                />
                <Text
                  style={[
                    styles.optionText,
                    dynamicStyles.optionText,
                    isReported && { color: "#ef4444" },
                  ]}
                >
                  {isReported ? "Reported" : "Report"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            // Regular User Options (for others' comments)
            <>
              <View style={[styles.divider, dynamicStyles.divider]} />

              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleReport}
              >
                <Ionicons
                  name={isReported ? "flag" : "flag-outline"}
                  size={24}
                  color={isReported ? "#ef4444" : colors.icon}
                />
                <Text
                  style={[
                    styles.optionText,
                    dynamicStyles.optionText,
                    isReported && { color: "#ef4444" },
                  ]}
                >
                  {isReported ? "Reported" : "Report"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Cancel Option */}
          <TouchableOpacity
            style={[styles.cancelButton, dynamicStyles.cancelButton]}
            onPress={onClose}
          >
            <Text
              style={[styles.cancelButtonText, dynamicStyles.cancelButtonText]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent", 
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingTop: 8,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
  },
  optionText: {
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
    fontWeight: "500",
  },
  deleteText: {
    color: "#ef4444",
  },
  divider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 20,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
    fontWeight: "600",
  },
});

export default React.memo(CommentOptionsModal);
