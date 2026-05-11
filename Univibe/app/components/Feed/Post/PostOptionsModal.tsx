// app/components/Feed/Post/PostOptionsModal.tsx

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
  isMuted?: boolean;
  isBlocked?: boolean;
  userName?: string;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onSave?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onHide?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onCopyLink?: (postId: string) => void;
  onMuteUser?: (userId: string, userName?: string) => void;
  onBlockUser?: (userId: string, userName?: string) => void;
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
  isMuted = false,
  isBlocked = false,
  userName,
  onEdit,
  onDelete,
  onSave,
  onReport,
  onHide,
  onShare,
  onCopyLink,
  onMuteUser,
  onBlockUser,
  userId,
}) => {
  const handleEdit = () => {
    onClose();
    if (onEdit) onEdit(postId);
  };

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

  const handleSave = () => {
    onClose();
    if (onSave) onSave(postId);
  };

  const handleCopyLink = () => {
    onClose();
    if (onCopyLink) onCopyLink(postId);
  };

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

  const handleHide = () => {
    const actionText = isHidden ? "unhide" : "hide";
    const actionMessage = isHidden
      ? "Do you want to unhide this post? It will reappear in your feed."
      : "Are you sure you want to hide this post? You won't see it in your feed.";

    Alert.alert(isHidden ? "Unhide Post" : "Hide Post", actionMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: isHidden ? "Unhide" : "Hide",
        style: isHidden ? "default" : "destructive",
        onPress: () => {
          onClose();
          if (onHide) onHide(postId);
        },
      },
    ]);
  };

  const handleShare = () => {
    onClose();
    if (onShare) onShare(postId);
  };

  const handleMuteUser = () => {
    const displayName = userName || "this user";
    const actionText = isMuted ? "unmute" : "mute";
    const actionMessage = isMuted
      ? `Do you want to unmute ${displayName}? You will see their posts again.`
      : `Are you sure you want to mute ${displayName}? You won't see their posts anymore.`;

    Alert.alert(isMuted ? "Unmute User" : "Mute User", actionMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: isMuted ? "Unmute" : "Mute",
        style: isMuted ? "default" : "destructive",
        onPress: () => {
          onClose();
          if (onMuteUser && userId) onMuteUser(userId, displayName);
        },
      },
    ]);
  };

  const handleBlockUser = () => {
    const displayName = userName || "this user";
    const actionText = isBlocked ? "unblock" : "block";
    const actionMessage = isBlocked
      ? `Do you want to unblock ${displayName}? They will be able to interact with you again.`
      : `Are you sure you want to block ${displayName}? You won't see their posts and they won't see yours.`;

    Alert.alert(isBlocked ? "Unblock User" : "Block User", actionMessage, [
      { text: "Cancel", style: "cancel" },
      {
        text: isBlocked ? "Unblock" : "Block",
        style: isBlocked ? "default" : "destructive",
        onPress: () => {
          onClose();
          if (onBlockUser && userId) onBlockUser(userId, displayName);
        },
      },
    ]);
  };

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

  const renderUserActions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleMuteUser}>
        <Ionicons
          name={isMuted ? "volume-high-outline" : "volume-mute-outline"}
          size={22}
          color={isMuted ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isMuted && styles.savedText]}>
          {isMuted ? "Unmute User" : "Mute User"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleBlockUser}>
        <Ionicons
          name={isBlocked ? "person-add-outline" : "ban-outline"}
          size={22}
          color={isBlocked ? "#8b5cf6" : "#ef4444"}
        />
        <Text
          style={[
            styles.optionText,
            isBlocked && styles.savedText,
            isBlocked ? {} : styles.deleteText,
          ]}
        >
          {isBlocked ? "Unblock User" : "Block User"}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />
    </>
  );

  const renderCommonOptions = () => (
    <>
      <TouchableOpacity style={styles.optionItem} onPress={handleSave}>
        <Ionicons
          name={isSaved ? "bookmark" : "bookmark-outline"}
          size={22}
          color={isSaved ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isSaved && styles.savedText]}>
          {isSaved ? "Unsave Post" : "Save Post"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleHide}>
        <Ionicons
          name={isHidden ? "eye-outline" : "eye-off-outline"}
          size={22}
          color={isHidden ? "#8b5cf6" : "#6b7280"}
        />
        <Text style={[styles.optionText, isHidden && styles.savedText]}>
          {isHidden ? "Unhide Post" : "Hide Post"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
        <Ionicons name="share-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Share Post</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.optionItem} onPress={handleCopyLink}>
        <Ionicons name="link-outline" size={22} color="#6b7280" />
        <Text style={styles.optionText}>Copy Link</Text>
      </TouchableOpacity>
    </>
  );

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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Post Options</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {isOwnPost ? renderOwnerOptions() : renderUserActions()}
          {renderCommonOptions()}
          {!isOwnPost && renderReportOption()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "80%",
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
    fontFamily: "SofiaSans-Bold",
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
    fontFamily: "SofiaSans-Regular",
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
