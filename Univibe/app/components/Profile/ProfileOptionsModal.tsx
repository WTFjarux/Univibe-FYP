// app/components/Profile/ProfileOptionsModal.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { profileService } from "../../../lib/services/profileService";
import { toggleBlockUser } from "../../../lib/services/contentService";
import ReportModal from "../../components/ReportModal";

interface ProfileOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  isBlocked: boolean;
  isMuted: boolean;
  isReported?: boolean;
  onBlockUser?: () => void;
  onUnblockUser?: () => void;
  onMuteUser?: () => void;
  onUnmuteUser?: () => void;
  onReportSuccess?: () => void;
  onShowInfoBar?: (message: string, type: "success" | "error" | "info") => void;
}

const ProfileOptionsModal: React.FC<ProfileOptionsModalProps> = ({
  visible,
  onClose,
  userId,
  userName,
  isBlocked,
  isMuted,
  isReported = false,
  onBlockUser,
  onUnblockUser,
  onMuteUser,
  onUnmuteUser,
  onReportSuccess,
  onShowInfoBar,
}) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [muting, setMuting] = useState(false);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setBlocking(false);
        setMuting(false);
        setShowReportModal(false); // Reset report modal too
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const showInfo = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    if (onShowInfoBar) {
      onShowInfoBar(message, type);
    }
    onClose();
  };

  const handleBlockUser = () => {
    const displayName = userName || "this user";

    Alert.alert(
      isBlocked ? "Unblock User" : "Block User",
      isBlocked
        ? `Do you want to unblock ${displayName}? They will be able to interact with you again.`
        : `Are you sure you want to block ${displayName}? You won't see their posts and they won't see yours.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isBlocked ? "Unblock" : "Block",
          style: isBlocked ? "default" : "destructive",
          onPress: async () => {
            setBlocking(true);
            try {
              const response = await toggleBlockUser(userId);
              if (response.blocked) {
                if (onBlockUser) onBlockUser();
                showInfo(`${displayName} blocked successfully`, "success");
              } else {
                if (onUnblockUser) onUnblockUser();
                showInfo(`${displayName} unblocked successfully`, "success");
              }
            } catch (error: any) {
              showInfo(
                error.message || "Failed to update block status",
                "error",
              );
            } finally {
              setBlocking(false);
            }
          },
        },
      ],
    );
  };

  const handleMuteUser = () => {
    const displayName = userName || "this user";

    Alert.alert(
      isMuted ? "Unmute User" : "Mute User",
      isMuted
        ? `Do you want to unmute ${displayName}? You will see their posts again.`
        : `Are you sure you want to mute ${displayName}? You won't see their posts anymore.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isMuted ? "Unmute" : "Mute",
          style: isMuted ? "default" : "destructive",
          onPress: async () => {
            setMuting(true);
            try {
              const response = await profileService.toggleMuteUser(userId);
              if (response.muted) {
                if (onMuteUser) onMuteUser();
                showInfo(`${displayName} muted successfully`, "info");
              } else {
                if (onUnmuteUser) onUnmuteUser();
                showInfo(`${displayName} unmuted successfully`, "info");
              }
            } catch (error: any) {
              showInfo(
                error.message || "Failed to update mute status",
                "error",
              );
            } finally {
              setMuting(false);
            }
          },
        },
      ],
    );
  };

  const handleReportPress = () => {
    if (isReported) {
      showInfo("You have already reported this user", "info");
      return;
    }
    setShowReportModal(true);
  };

  // FIX: Close both modals when report modal closes
  const handleReportModalClose = () => {
    setShowReportModal(false);
    onClose(); // Also close the options modal
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      {/* MAIN OPTIONS MODAL */}
      <Modal
        visible={visible && !showReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleClose}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Options</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Block User */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleBlockUser}
              disabled={blocking}
            >
              <Ionicons
                name={isBlocked ? "checkmark-circle-outline" : "ban-outline"}
                size={22}
                color={isBlocked ? "#8b5cf6" : "#ef4444"}
              />
              <Text
                style={[styles.optionText, !isBlocked && styles.dangerText]}
              >
                {blocking
                  ? isBlocked
                    ? "Unblocking..."
                    : "Blocking..."
                  : isBlocked
                    ? "Unblock User"
                    : "Block User"}
              </Text>
              {blocking && <ActivityIndicator size="small" color="#8b5cf6" />}
            </TouchableOpacity>

            {/* Mute User */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleMuteUser}
              disabled={muting}
            >
              <Ionicons
                name={isMuted ? "volume-high-outline" : "volume-mute-outline"}
                size={22}
                color={isMuted ? "#8b5cf6" : "#6b7280"}
              />
              <Text style={[styles.optionText, isMuted && styles.activeText]}>
                {muting
                  ? isMuted
                    ? "Unmuting..."
                    : "Muting..."
                  : isMuted
                    ? "Unmute User"
                    : "Mute User"}
              </Text>
              {muting && <ActivityIndicator size="small" color="#8b5cf6" />}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Report User */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleReportPress}
              disabled={isReported}
            >
              <Ionicons
                name={isReported ? "flag" : "flag-outline"}
                size={22}
                color={isReported ? "#d1d5db" : "#ef4444"}
              />
              <Text
                style={[
                  styles.optionText,
                  isReported ? styles.reportedText : styles.dangerText,
                ]}
              >
                {isReported ? "Already Reported" : "Report User"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Cancel */}
            <TouchableOpacity style={styles.optionItem} onPress={handleClose}>
              <Text style={[styles.optionText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* REPORT MODAL - Closes both modals when dismissed */}
      <ReportModal
        visible={showReportModal}
        onClose={handleReportModalClose}
        targetType="User"
        targetId={userId}
        targetName={userName}
        onReportSuccess={() => {
          if (onReportSuccess) onReportSuccess();
          // Don't call onClose here - let showInfo handle it
        }}
        onShowInfoBar={(message, type) => {
          // Override to ensure both modals close
          if (onShowInfoBar) {
            onShowInfoBar(message, type);
          }
          onClose();
        }}
        reportFunction={(targetId: string, reason: string) =>
          profileService.reportUser(targetId, reason)
        }
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,

    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
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
  dangerText: {
    color: "#ef4444",
  },
  activeText: {
    color: "#8b5cf6",
  },
  reportedText: {
    color: "#d1d5db",
  },
  cancelText: {
    color: "#6b7280",
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginVertical: 8,
  },
});

export default ProfileOptionsModal;
