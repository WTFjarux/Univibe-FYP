import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CommentOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  commentId: string;
  isOwnComment: boolean;
  isPostOwner: boolean;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onReport?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onShare?: (commentId: string) => void;
  onHide?: (commentId: string) => void;
}

const CommentOptionsModal: React.FC<CommentOptionsModalProps> = ({
  visible,
  onClose,
  commentId,
  isOwnComment,
  isPostOwner,
  onEdit,
  onDelete,
  onReport,
  onReply,
  onShare,
  onHide,
}) => {
  const handleReply = () => {
    onClose();
    if (onReply) onReply(commentId);
  };

  const handleEdit = () => {
    onClose();
    if (onEdit) onEdit(commentId);
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
            if (onDelete) onDelete(commentId);
          },
        },
      ],
    );
  };

  const handleShare = () => {
    onClose();
    if (onShare) onShare(commentId);
  };

  const handleHide = () => {
    Alert.alert("Hide Comment", "Are you sure you want to hide this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Hide",
        style: "destructive",
        onPress: () => {
          onClose();
          if (onHide) onHide(commentId);
        },
      },
    ]);
  };

  const handleReport = () => {
    Alert.alert("Report Comment", "Why are you reporting this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Spam",
        onPress: () => {
          onClose();
          if (onReport) onReport(commentId);
        },
      },
      {
        text: "Inappropriate",
        onPress: () => {
          onClose();
          if (onReport) onReport(commentId);
        },
      },
      {
        text: "Harassment",
        onPress: () => {
          onClose();
          if (onReport) onReport(commentId);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContent}>
          {/* Reply - Available for everyone */}
          <TouchableOpacity style={styles.optionItem} onPress={handleReply}>
            <Ionicons name="chatbubble-outline" size={24} color="#374151" />
            <Text style={styles.optionText}>Reply</Text>
          </TouchableOpacity>

          {/* Share - Available for everyone */}
          <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#374151" />
            <Text style={styles.optionText}>Share</Text>
          </TouchableOpacity>

          {/* Comment Owner Specific Options */}
          {isOwnComment ? (
            <>
              <View style={styles.divider} />

              <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={24} color="#374151" />
                <Text style={styles.optionText}>Edit</Text>
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
              <View style={styles.divider} />

              <TouchableOpacity style={styles.optionItem} onPress={handleHide}>
                <Ionicons name="eye-off-outline" size={24} color="#374151" />
                <Text style={styles.optionText}>Hide</Text>
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
                <Ionicons name="flag-outline" size={24} color="#374151" />
                <Text style={styles.optionText}>Report</Text>
              </TouchableOpacity>
            </>
          ) : (
            // Regular User Options (for others' comments)
            <>
              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.optionItem}
                onPress={handleReport}
              >
                <Ionicons name="flag-outline" size={24} color="#374151" />
                <Text style={styles.optionText}>Report</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Cancel Option */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
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
    color: "#374151",
    fontWeight: "500",
  },
  deleteText: {
    color: "#ef4444",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 4,
    marginHorizontal: 20,
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#6b7280",
    fontWeight: "600",
  },
});

export default CommentOptionsModal;
