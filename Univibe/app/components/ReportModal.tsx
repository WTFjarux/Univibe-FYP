// app/components/ReportModal.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: "Post" | "Comment" | "User" | "Event";
  targetId: string;
  targetName?: string;
  onReportSuccess?: () => void;
  onShowInfoBar?: (message: string, type: "success" | "error" | "info") => void;
  reportFunction: (
    targetId: string,
    reason: string,
  ) => Promise<{ success: boolean; message?: string }>;
}

const REPORT_REASONS = [
  {
    id: "spam",
    label: "Spam",
    icon: "megaphone-outline",
    description: "Excessive messaging or promotional content",
  },
  {
    id: "harassment",
    label: "Harassment",
    icon: "hand-left-outline",
    description: "Bullying, threats, or unwanted contact",
  },
  {
    id: "hate_speech",
    label: "Hate Speech",
    icon: "chatbubbles-outline",
    description: "Discriminatory or hateful content",
  },
  {
    id: "inappropriate_content",
    label: "Inappropriate Content",
    icon: "eye-off-outline",
    description: "NSFW, offensive, or disturbing content",
  },
  {
    id: "violence",
    label: "Violence",
    icon: "warning-outline",
    description: "Violent or threatening content",
  },
  {
    id: "misinformation",
    label: "Misinformation",
    icon: "alert-circle-outline",
    description: "False or misleading information",
  },
  {
    id: "impersonation",
    label: "Impersonation",
    icon: "person-remove-outline",
    description: "Pretending to be someone else",
  },
  {
    id: "other",
    label: "Other",
    icon: "ellipsis-horizontal-outline",
    description: "Something else concerning",
  },
];

const TARGET_TYPE_LABELS = {
  Post: "post",
  Comment: "comment",
  User: "user",
  Event: "event",
};

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  targetType,
  targetId,
  targetName,
  onReportSuccess,
  onShowInfoBar,
  reportFunction,
}) => {
  const [reporting, setReporting] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const hasSubmitted = useRef(false);
  const isMounted = useRef(true);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setReporting(false);
      setSelectedReason(null);
      hasSubmitted.current = false;
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleReport = async (reason: string) => {
    // Prevent duplicate submissions
    if (hasSubmitted.current || reporting) return;
    hasSubmitted.current = true;

    setSelectedReason(reason);
    setReporting(true);

    try {
      const response = await reportFunction(targetId, reason);

      if (!isMounted.current) return;

      if (response.success) {
        // Close modal first
        onClose();

        // Use onModalHide or parent coordination instead of setTimeout
        // The parent (FeedScreen) will handle showing success message
        // after ReportModal's onModalHide fires
        if (onReportSuccess) {
          onReportSuccess();
        }

        if (onShowInfoBar) {
          onShowInfoBar(
            "Report submitted. Thank you for your feedback.",
            "success",
          );
        }
      } else {
        // Handle error cases - keep modal open to show error
        if (onShowInfoBar) {
          if (response.message?.includes("already reported")) {
            onShowInfoBar(
              `You have already reported this ${TARGET_TYPE_LABELS[targetType]}`,
              "info",
            );
          } else {
            onShowInfoBar(
              response.message || "Failed to submit report",
              "error",
            );
          }
        }

        // Reset state so user can try again
        setReporting(false);
        setSelectedReason(null);
        hasSubmitted.current = false;
      }
    } catch (error: any) {
      if (!isMounted.current) return;

      if (onShowInfoBar) {
        onShowInfoBar(error.message || "Failed to submit report", "error");
      }

      // Reset state on error
      setReporting(false);
      setSelectedReason(null);
      hasSubmitted.current = false;
    }
  };

  const getTitle = () => {
    if (targetType === "User" && targetName) {
      return `Report ${targetName}`;
    }
    return `Report ${TARGET_TYPE_LABELS[targetType]}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        if (!reporting) onClose();
      }}
      statusBarTranslucent={Platform.OS === "android"}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => {
          if (!reporting) onClose();
        }}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{getTitle()}</Text>
            <TouchableOpacity
              onPress={() => {
                if (!reporting) onClose();
              }}
              disabled={reporting}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <Text style={styles.reportDescription}>
            Please select a reason for reporting this{" "}
            {TARGET_TYPE_LABELS[targetType]}. Your report will be reviewed by
            our team.
          </Text>

          {reporting ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8b5cf6" />
              <Text style={styles.loadingText}>Submitting report...</Text>
            </View>
          ) : (
            <>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reportReasonItem,
                    selectedReason === reason.id &&
                      styles.reportReasonItemSelected,
                  ]}
                  onPress={() => handleReport(reason.id)}
                  disabled={reporting}
                >
                  <View style={styles.reportReasonIcon}>
                    <Ionicons
                      name={reason.icon as any}
                      size={22}
                      color={
                        selectedReason === reason.id ? "#8b5cf6" : "#6b7280"
                      }
                    />
                  </View>
                  <View style={styles.reportReasonContent}>
                    <Text
                      style={[
                        styles.reportReasonLabel,
                        selectedReason === reason.id &&
                          styles.reportReasonLabelSelected,
                      ]}
                    >
                      {reason.label}
                    </Text>
                    <Text style={styles.reportReasonDescription}>
                      {reason.description}
                    </Text>
                  </View>
                  {reporting && selectedReason === reason.id ? (
                    <ActivityIndicator size="small" color="#8b5cf6" />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#d1d5db"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              if (!reporting) onClose();
            }}
            disabled={reporting}
          >
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
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
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
  reportDescription: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
    paddingHorizontal: 20,
    paddingVertical: 12,
    lineHeight: 20,
  },
  reportReasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  reportReasonItemSelected: { backgroundColor: "#f5f3ff" },
  reportReasonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  reportReasonContent: { flex: 1 },
  reportReasonLabel: {
    fontSize: 16,
    fontFamily: "SofiaSans-SemiBold",
    color: "#111827",
    fontWeight: "600",
  },
  reportReasonLabelSelected: { color: "#8b5cf6" },
  reportReasonDescription: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
    marginTop: 2,
  },
  loadingContainer: { alignItems: "center", paddingVertical: 40 },
  loadingText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#6b7280",
    marginTop: 12,
  },
  cancelButton: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: "SofiaSans-SemiBold",
    color: "#374151",
    fontWeight: "600",
  },
});

export default ReportModal;
