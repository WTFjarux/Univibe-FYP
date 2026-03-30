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

interface PostOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  isOwnPost: boolean;
  isSaved?: boolean;
  isReported?: boolean;
  isHidden?: boolean;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onMuteUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
  userId?: string;
}

const PostOptionsModal: React.FC<PostOptionsModalProps> = ({
  visible,
  onClose,
  postId,
  isOwnPost,
  isSaved = false,
  isReported = false,
  isHidden = false,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onHide,
  onShare,
  onMuteUser,
  onBlockUser,
  userId,
}) => {
  /**
   * Handle edit post action
   */
  const handleEdit = () => {
    onClose();
    if (onEdit) onEdit(postId);
  };

  /**
   * Handle delete post with confirmation
   */
  const handleDelete = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onDelete) onDelete(postId);
          },
        },
      ],
    );
  };

  /**
   * Handle save/unsave post
   */
  const handleSave = () => {
    onClose();
    if (onSave) onSave(postId);
  };

  /**
   * Handle report post with reason selection
   */
  const handleReport = () => {
    Alert.alert("Report Post", "Why are you reporting this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Spam",
        onPress: () => {
          onClose();
          if (onReport) onReport(postId);
        },
      },
      {
        text: "Inappropriate",
        onPress: () => {
          onClose();
          if (onReport) onReport(postId);
        },
      },
      {
        text: "Harassment",
        onPress: () => {
          onClose();
          if (onReport) onReport(postId);
        },
      },
    ]);
  };

  /**
   * Handle hide post
   */
  const handleHide = () => {
    onClose();
    if (onHide) onHide(postId);
  };

  /**
   * Handle share post
   */
  const handleShare = () => {
    onClose();
    if (onShare) onShare(postId);
  };

  /**
   * Handle mute user
   */
  const handleMuteUser = () => {
    Alert.alert(
      "Mute User",
      "Are you sure you want to mute this user? You won't see their posts anymore.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mute",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onMuteUser && userId) onMuteUser(userId);
          },
        },
      ],
    );
  };

  /**
   * Handle block user
   */
  const handleBlockUser = () => {
    Alert.alert(
      "Block User",
      "Are you sure you want to block this user? You won't see their posts and they won't see yours.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            onClose();
            if (onBlockUser && userId) onBlockUser(userId);
          },
        },
      ],
    );
  };

  /**
   * Render owner options (Edit/Delete)
   */
  const renderOwnerOptions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleEdit}>
        <Ionicons name="pencil-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Edit Post</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={22} color="#ef4444" />
        <Text style={[styles.optionText, styles.deleteText]}>Delete Post</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
    </>
  );

  /**
   * Render user actions (Mute/Block)
   */
  const renderUserActions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleMuteUser}>
        <Ionicons name="volume-mute-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Mute User</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleBlockUser}>
        <Ionicons name="ban-outline" size={22} color="#ef4444" />
        <Text style={[styles.optionText, styles.deleteText]}>Block User</Text>
      </TouchableOpacity>

      <View style={styles.divider} />
    </>
  );

  /**
   * Render common options for all users
   */
  const renderCommonOptions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleSave}>
        <Ionicons
          name={isSaved ? "bookmark" : "bookmark-outline"}
          size={22}
          color={isSaved ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isSaved && styles.savedText]}>
          {isSaved ? "Saved" : "Save Post"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleHide}>
        <Ionicons
          name={isHidden ? "eye-off" : "eye-off-outline"}
          size={22}
          color={isHidden ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isHidden && styles.savedText]}>
          {isHidden ? "Hidden" : "Hide Post"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
        <Ionicons name="share-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Share Post</Text>
      </TouchableOpacity>
    </>
  );

  /**
   * Render report option (only for non-owners)
   */
  const renderReportOption = () => (
    <>
      <View style={styles.divider} />
      <TouchableOpacity style={styles.optionItem} onPress={handleReport}>
        <Ionicons
          name={isReported ? "flag" : "flag-outline"}
          size={22}
          color={isReported ? "#ef4444" : "#6b7280"}
        />
        <Text style={[styles.optionText, isReported && styles.reportedText]}>
          {isReported ? "Reported" : "Report Post"}
        </Text>
      </TouchableOpacity>
    </>
  );

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
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post Options</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Dynamic Options based on ownership */}
          {isOwnPost ? renderOwnerOptions() : renderUserActions()}

          {/* Common Options for all users */}
          {renderCommonOptions()}

          {/* Report option for non-owners */}
          {!isOwnPost && renderReportOption()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent", // Fully transparent background
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "80%",
    // Add shadow for better visibility on transparent background
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  deleteText: {
    color: "#ef4444",
  },
  savedText: {
    color: "#8b5cf6",
  },
  reportedText: {
    color: "#ef4444",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 8,
  },
});

export default PostOptionsModal;
